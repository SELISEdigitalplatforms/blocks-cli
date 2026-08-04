import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { applyAccountToken, applyProjectToken } from "../dist/lib/token.js";
import { writeConfig as writeConfigFile } from "../dist/lib/config.js";
import { writeTokenStore } from "../dist/lib/token-store.js";
import { getAccountSession, pollDeviceToken } from "../dist/lib/auth.js";
import { CliActionableError } from "../dist/lib/errors.js";
import { listSkills, parseFrontmatter, readSkill } from "../dist/lib/skills.js";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");

test("account token refresh preserves the previous refresh token when the response omits one", () => {
  const store = {
    accounts: {
      default: {
        account: {
          accessToken: "old-access-token",
          accountTenant: "root-tenant",
          expiresAt: new Date(Date.now() - 60_000).toISOString(),
          refreshToken: "old-refresh-token",
          tokenType: "Bearer"
        }
      }
    }
  };
  const config = { accounts: { default: {} } };
  const response = { access_token: fakeJwt({ tenant_id: "root-tenant" }), expires_in: 3600 };

  const next = applyAccountToken(config, store, "default", "client-id", response);

  assert.equal(next.store.accounts.default.account.refreshToken, "old-refresh-token");
  assert.equal(next.store.accounts.default.account.accessToken, response.access_token);
});

test("account tokens prefer the JWT access expiry and record refresh-token expiry", () => {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const accessToken = fakeJwt({ exp: nowSeconds + 8 * 60, tenant_id: "root-tenant" });
  const refreshToken = fakeJwt({ exp: nowSeconds + 30 * 60 });
  const next = applyAccountToken(
    { accounts: { default: {} } },
    { accounts: {} },
    "default",
    "client-id",
    { access_token: accessToken, expires_in: 10, refresh_token: refreshToken }
  );

  assert.equal(next.store.accounts.default.account.expiresAt, new Date((nowSeconds + 8 * 60) * 1000).toISOString());
  assert.equal(next.store.accounts.default.account.refreshTokenExpiresAt, new Date((nowSeconds + 30 * 60) * 1000).toISOString());
});

test("opaque refresh tokens use refresh expiry metadata", () => {
  const before = Date.now();
  const next = applyAccountToken(
    { accounts: { default: {} } },
    { accounts: {} },
    "default",
    "client-id",
    {
      access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 8 * 60, tenant_id: "root-tenant" }),
      refresh_expires_in: 30 * 60,
      refresh_token: "opaque-refresh-token"
    }
  );

  const expiry = new Date(next.store.accounts.default.account.refreshTokenExpiresAt).getTime();
  assert.ok(expiry >= before + 30 * 60 * 1000);
  assert.ok(expiry <= Date.now() + 30 * 60 * 1000);
});

test("project token refresh preserves the previous refresh token when the response omits one", () => {
  const store = {
    accounts: {
      default: {
        projects: {
          "project-tenant": {
            accessToken: "old-project-access-token",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            refreshToken: "old-project-refresh-token",
            tokenType: "Bearer"
          }
        }
      }
    }
  };
  const config = {};
  const response = { access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600 }) };

  const next = applyProjectToken(config, store, "default", "project-tenant", response);

  assert.equal(next.store.accounts.default.projects["project-tenant"].refreshToken, "old-project-refresh-token");
  assert.equal(next.store.accounts.default.projects["project-tenant"].accessToken, response.access_token);
});

test("account session refresh surfaces a clear next step when the identity provider rejects the refresh token", async () => {
  const { configDir } = await makeWorkspace();
  const originalConfigDir = process.env.BLOCKS_OS_CONFIG_DIR;
  const originalSecretStore = process.env.BLOCKS_OS_SECRET_STORE;
  const originalFetch = globalThis.fetch;

  process.env.BLOCKS_OS_CONFIG_DIR = configDir;
  process.env.BLOCKS_OS_SECRET_STORE = "file";
  // The OIDC server rejects an expired/revoked refresh token -- no
  // error_description, just the bare OAuth error code, to prove the
  // resulting CLI error doesn't depend on any particular wording.
  globalThis.fetch = async () => new Response(JSON.stringify({ error: "invalid_grant" }), {
    headers: { "content-type": "application/json" },
    status: 400
  });

  try {
    await writeConfigFile({
      activeAccount: "default",
      accounts: {
        default: {
          apiUrl: "https://api.seliseblocks.com",
          clientId: "client-id",
          createdAt: "2026-01-01T00:00:00.000Z",
          oidcUrl: "https://iam.seliseblocks.com",
          osUrl: "https://os.seliseblocks.com",
          rootTenantId: "root-tenant",
          scope: "openid profile offline_access",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      }
    });
    await writeTokenStore({
      accounts: {
        default: {
          account: {
            accessToken: "old-access-token",
            accountTenant: "root-tenant",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            refreshToken: "old-refresh-token",
            tokenType: "Bearer"
          }
        }
      }
    });

    await assert.rejects(() => getAccountSession("default"), (error) => {
      assert.ok(error instanceof CliActionableError);
      assert.equal(error.code, "refresh_token_rejected");
      assert.equal(error.nextStep, "blocks-os login");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) delete process.env.BLOCKS_OS_CONFIG_DIR;
    else process.env.BLOCKS_OS_CONFIG_DIR = originalConfigDir;
    if (originalSecretStore === undefined) delete process.env.BLOCKS_OS_SECRET_STORE;
    else process.env.BLOCKS_OS_SECRET_STORE = originalSecretStore;
  }
});

test("device token polling succeeds after authorization_pending retries", async () => {
  await withDevicePollingEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls < 3) return jsonResponse({ error: "authorization_pending" }, 400);
      return jsonResponse({ access_token: fakeJwt({ tenant_id: "root-tenant" }), expires_in: 3600 });
    };

    const token = await pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 30, interval: 1 }));
    assert.equal(calls, 3);
    assert.ok(token.access_token);
  });
});

test("device token polling honors slow_down before succeeding", async () => {
  await withDevicePollingEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      if (calls === 1) return jsonResponse({ error: "slow_down" }, 400);
      if (calls === 2) return jsonResponse({ error: "authorization_pending" }, 400);
      return jsonResponse({ access_token: fakeJwt({ tenant_id: "root-tenant" }), expires_in: 3600 });
    };

    const start = Date.now();
    const token = await pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 30, interval: 1 }));
    assert.equal(calls, 3);
    assert.ok(token.access_token);
    // interval starts at 1s, slow_down bumps it to 6s -- the second and
    // third polls alone should take at least ~6s, proving slow_down was honored.
    assert.ok(Date.now() - start >= 6_000, "expected slow_down to increase the poll interval");
  });
});

test("device token polling surfaces access_denied as an actionable error", async () => {
  await withDevicePollingEnv(async () => {
    globalThis.fetch = async () => jsonResponse({ error: "access_denied" }, 400);

    await assert.rejects(
      () => pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 30, interval: 1 })),
      (error) => {
        assert.ok(error instanceof CliActionableError);
        assert.equal(error.code, "device_login_denied");
        return true;
      }
    );
  });
});

test("device token polling retries transient network failures before giving up", async () => {
  await withDevicePollingEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      throw new Error("network down");
    };

    await assert.rejects(
      () => pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 30, interval: 1 })),
      (error) => {
        assert.ok(error instanceof CliActionableError);
        assert.equal(error.code, "device_login_network_error");
        assert.match(error.message, /network down/);
        return true;
      }
    );
    // MAX_CONSECUTIVE_TRANSIENT_ERRORS is 3 -- it should keep retrying past
    // the first failure and only give up once the streak exceeds that.
    assert.ok(calls > 3, `expected more than 3 retries before giving up, got ${calls}`);
  });
});

test("device token polling resets the transient-error streak after a successful poll response", async () => {
  await withDevicePollingEnv(async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls += 1;
      // Two network failures, then a real (non-fatal) response that should
      // reset the streak, then two more failures -- neither burst alone
      // exceeds MAX_CONSECUTIVE_TRANSIENT_ERRORS (3), so this must succeed.
      if (calls === 1 || calls === 2 || calls === 4 || calls === 5) throw new Error("network down");
      if (calls === 3) return jsonResponse({ error: "authorization_pending" }, 400);
      return jsonResponse({ access_token: fakeJwt({ tenant_id: "root-tenant" }), expires_in: 3600 });
    };

    const token = await pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 30, interval: 1 }));
    assert.equal(calls, 6);
    assert.ok(token.access_token);
  });
});

test("device token polling reports expiration once the deadline passes", async () => {
  await withDevicePollingEnv(async () => {
    globalThis.fetch = async () => jsonResponse({ error: "authorization_pending" }, 400);

    await assert.rejects(
      () => pollDeviceToken(deviceProfile(), deviceAuthorization({ expires_in: 1, interval: 1 })),
      (error) => {
        assert.ok(error instanceof CliActionableError);
        assert.equal(error.code, "device_login_expired");
        return true;
      }
    );
  });
});

test("scaffolded web app depends on @seliseblocks/client and has no custom Blocks fetch wrapper", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" });

  const result = run([
    "new", "web", "demo-app",
    "--x-blocks-key", "test-tenant-key",
    "--app-domain", "https://demo.example.test",
    "--client-id", "demo-client-id"
  ], { cwd, env });
  assert.equal(result.status, 0, result.stderr);

  const appDir = join(cwd, "demo-app");
  const pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
  assert.ok(pkg.dependencies["@seliseblocks/client"], "expected a @seliseblocks/client dependency");
  assert.ok(pkg.devDependencies.selfsigned, "expected generated cert script to work without openssl");

  const files = await collectFiles(join(appDir, "src"));
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const combined = contents.join("\n");

  assert.match(combined, /createBlocksClient/, "expected createBlocksClient to be used somewhere");
  assert.match(combined, /blocksClient\.auth\.idp\.redirectToProvider\(\)/, "login click should start through IdP initiate");
  assert.match(combined, /blocksClient\.auth\.idp\.callback\(callbackUrl\)/, "callback should complete through IdP callback");
  assert.match(combined, /blocksClient\.auth\.oidc\.refreshToken/, "refresh should use the SDK OIDC refresh helper");
  assert.match(combined, /blocksClient\.data\.collection<Asset>\("Asset"/, "expected an Assets CRUD example through Blocks Data");
  assert.match(combined, /blocksClient\.localization\.load/, "expected localization to load through the Blocks client");
  assert.match(combined, /useT\(/, "expected generated UI to consume localization helper");
  assert.doesNotMatch(combined, /blocksFetch\(/, "no generated file should call a custom blocksFetch wrapper");
  assert.doesNotMatch(combined, /fetch\(`\$\{blocksConfig\.apiUrl\}/, "no generated file should hand-rolled fetch() against blocksConfig.apiUrl");
  assert.doesNotMatch(combined, /auth\.form</, "generated hosted login must not use the raw OIDC token form helper");
  assert.doesNotMatch(combined, /oidc\/authorize/, "generated hosted login must not manually build the OIDC authorize URL");
  assert.doesNotMatch(combined, /createPkcePair|code_verifier|code_challenge/, "generated hosted login must rely on IAM IdP initiate instead of local PKCE construction");
  assert.doesNotMatch(combined, /VITE_BLOCKS_OIDC_CLIENT_SECRET/, "generated source must not reference a client secret env var");

  const envExample = await readFile(join(appDir, ".env.example"), "utf8");
  const envFile = await readFile(join(appDir, ".env"), "utf8");
  assert.doesNotMatch(envExample, /VITE_BLOCKS_OIDC_CLIENT_SECRET/);
  assert.doesNotMatch(envFile, /VITE_BLOCKS_OIDC_CLIENT_SECRET/);
  assert.match(envFile, /^VITE_BLOCKS_OIDC_URL=https:\/\/iam\.seliseblocks\.com$/m);
  assert.match(envFile, /^VITE_BLOCKS_DEV_HOST=demo\.example\.test$/m);

  await assert.rejects(() => readFile(join(appDir, "src/lib/blocks/http.ts"), "utf8"), /ENOENT/, "the generic Blocks fetch wrapper file should not be generated");

  assert.ok(files.some((file) => file.endsWith("AssetsPage.tsx")), "expected an Assets CRUD page");
  assert.ok(files.some((file) => file.endsWith("DataTable.tsx")), "expected a reusable data table");
  assert.ok(files.some((file) => file.endsWith("LocalizationProvider.tsx")), "expected a localization provider");
  // Each SDK module is exercised in context rather than in one dedicated demo
  // panel: auth/data/localization are already covered above (idp login flow,
  // Assets CRUD, LocalizationProvider); iam is covered through the shared
  // profile/user-menu query.
  assert.match(combined, /blocksClient\.iam\./, "expected an iam example");

  await assert.rejects(() => readFile(join(appDir, "src/lib/blocks/pkce.ts"), "utf8"), /ENOENT/, "the hosted IdP scaffold should not generate a local PKCE helper");
});

test("fresh workspace dry-run commands do not require data files", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    accounts: {},
    selectedProject: { tenantId: "project-tenant" }
  });

  const env = testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" });

  const schema = run(["data:schema:push", "--dry-run", "--json"], { cwd, env });
  assert.equal(schema.status, 0, schema.stderr);
  assert.deepEqual(JSON.parse(schema.stdout), { dryRun: true, schemas: [] });

  const rules = run(["data:rules:deploy", "--dry-run", "--json"], { cwd, env });
  assert.equal(rules.status, 0, rules.stderr);
  assert.deepEqual(JSON.parse(rules.stdout), { dryRun: true, policies: 0, security: 0 });
});

test("localization validate accepts nested i18n JSON and reports flattened key count", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await mkdir(join(cwd, "blocks", "localization"), { recursive: true });
  await writeFile(join(cwd, "blocks", "localization", "common.en.json"), `${JSON.stringify({
    dashboard: { title: "Dashboard" },
    products: { empty: "No products" }
  }, null, 2)}\n`);

  const result = run(["localization:validate", "--module", "common", "--language", "en", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.file, join("blocks", "localization", "common.en.json"));
  assert.equal(output.keys, 2);
  assert.equal(output.valid, true);
});

test("localization push uses v4 gateway paths without api segment", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await mkdir(join(cwd, "blocks", "localization"), { recursive: true });
  await writeFile(join(cwd, "blocks", "localization", "common.en.json"), `${JSON.stringify({
    "dashboard.title": "Dashboard",
    "products.title": "Products"
  }, null, 2)}\n`);
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.seliseblocks.com",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.seliseblocks.com",
        osUrl: "https://os.seliseblocks.com",
        rootTenantId: "root-tenant",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    },
    selectedProject: { tenantId: "project-tenant" }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      default: {
        account: {
          accessToken: fakeJwt({ tenant_id: "root-tenant" }),
          accountTenant: "root-tenant",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          refreshToken: "account-refresh-token",
          tokenType: "Bearer"
        },
        projects: {
          "project-tenant": {
            accessToken: fakeJwt({ tenant_id: "project-tenant" }),
            accountTenant: "project-tenant",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            refreshToken: "project-refresh-token",
            tokenType: "Bearer"
          }
        }
      }
    }
  }, null, 2)}\n`);

  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    if (request.url === "/localization/v4/Module/Gets") return [{ itemId: "module-1", moduleName: "common" }];
    if (request.url === "/localization/v4/Key/SaveKeys") return { success: true };
    return { success: false, errorMessage: `Unexpected ${request.method} ${request.url}` };
  });

  try {
    const result = await runAsync([
      "localization:push",
      "--module", "common",
      "--language", "en",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, JSON.stringify({
      error: result.error?.message,
      requests,
      signal: result.signal,
      stderr: result.stderr,
      stdout: result.stdout
    }, null, 2));
    assert.deepEqual(requests.map((item) => item.url), ["/localization/v4/Module/Gets", "/localization/v4/Key/SaveKeys"]);
    assert.equal(requests[1].body.length, 2);
    assert.equal(requests[1].body[0].moduleId, "module-1");
    assert.equal(requests[1].body[0].resources[0].culture, "en");
    assert.ok(!requests.some((item) => item.url.includes("/api/")), "gateway v4 paths must not include /api");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("prints package version", async () => {
  const pkg = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8"));
  const { cwd, configDir } = await makeWorkspace();

  const result = run(["--version"], { cwd, env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" }) });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), pkg.version);
});

test("fresh auth status hides packaged account defaults", async () => {
  const { cwd, configDir } = await makeWorkspace();

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.deepEqual(status, {
    accountAccessToken: "missing",
    accountRefreshToken: "missing",
    projectAccessToken: "missing",
    projectRefreshToken: "missing"
  });
});

test("empty config auth status hides packaged account defaults", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, { accounts: {} });

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.deepEqual(status, {
    accountAccessToken: "missing",
    accountRefreshToken: "missing",
    projectAccessToken: "missing",
    projectRefreshToken: "missing"
  });
});

test("auth status uses active account when account flag is omitted", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "dev",
    accounts: {
      dev: {
        apiUrl: "https://os.local.example.test",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.local.example.test",
        osUrl: "https://portal.local.example.test",
        rootTenantId: "dev-root",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.deepEqual(status, {
    accountAccessToken: "missing",
    accountRefreshToken: "missing",
    projectAccessToken: "missing",
    projectRefreshToken: "missing"
  });
});

test("stored default account values are not exposed by auth status", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://old-api.example.test",
        clientId: "old-client-id",
        createdAt: "2025-01-01T00:00:00.000Z",
        oidcUrl: "https://old-iam.example.test",
        osUrl: "https://old-os.example.test",
        rootTenantId: "old-root",
        scope: "openid",
        updatedAt: "2025-01-01T00:00:00.000Z"
      }
    }
  });

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.deepEqual(status, {
    accountAccessToken: "missing",
    accountRefreshToken: "missing",
    projectAccessToken: "missing",
    projectRefreshToken: "missing"
  });
});

test("auth status reports only token existence and validity", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.seliseblocks.com",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.seliseblocks.com",
        osUrl: "https://os.seliseblocks.com",
        rootTenantId: "root-tenant",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    },
    selectedProject: { tenantId: "project-tenant" }
  });
  await writeSecretStore(configDir, {
    accounts: {
      "oauth-token-store": {
        clientSecret: JSON.stringify({
          accounts: {
            default: {
              account: {
                accessToken: "account-access",
                expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
                refreshToken: "account-refresh",
                tokenType: "Bearer"
              },
              projects: {
                "project-tenant": {
                  accessToken: "project-access",
                  expiresAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                  refreshToken: "project-refresh",
                  tokenType: "Bearer"
                }
              }
            }
          }
        })
      }
    }
  });

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    accountAccessToken: "valid",
    accountRefreshToken: "available",
    projectAccessToken: "expired",
    projectRefreshToken: "available"
  });
});

test("init uses centralized default API URL", async () => {
  const { cwd, configDir } = await makeWorkspace();

  const result = run(["init"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const blocksConfig = JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8"));
  const envExample = await readFile(join(cwd, ".env.example"), "utf8");
  assert.equal(blocksConfig.project.apiUrl, "https://os.seliseblocks.com");
  assert.match(envExample, /^VITE_BLOCKS_API_URL=https:\/\/os\.seliseblocks\.com$/m);
});

test("new web uses centralized default URLs when no API/OIDC overrides are passed", async () => {
  const { cwd, configDir } = await makeWorkspace();

  const result = run([
    "new", "web", "dev-app",
    "--x-blocks-key", "dev-project-key",
    "--app-domain", "https://dev-app.example.test"
  ], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const envFile = await readFile(join(cwd, "dev-app", ".env"), "utf8");
  assert.match(envFile, /^VITE_BLOCKS_API_URL=https:\/\/os\.seliseblocks\.com$/m);
  assert.match(envFile, /^VITE_BLOCKS_OIDC_URL=https:\/\/iam\.seliseblocks\.com$/m);
});

test("json mode emits structured auth errors", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.seliseblocks.com",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.seliseblocks.com",
        osUrl: "https://os.seliseblocks.com",
        rootTenantId: "root-tenant",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });

  const result = run(["projects:list", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" })
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");

  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "not_logged_in");
  assert.equal(error.nextStep, "blocks-os login, then blocks-os projects list, then blocks-os use <tenantId>");
});

test("auth:status tolerates stale Windows DPAPI values", { skip: process.platform !== "win32" }, async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.seliseblocks.com",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.seliseblocks.com",
        osUrl: "https://os.seliseblocks.com",
        rootTenantId: "root-tenant",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });
  await writeSecretStore(configDir, {
    accounts: {
      "client-secret:default": { clientSecretDpapi: "not-valid-dpapi" },
      "oauth-token-store": { clientSecretDpapi: "not-valid-dpapi" }
    }
  });

  const result = run(["auth:status", "--json"], { cwd, env: testEnv(configDir) });
  assert.equal(result.status, 0, result.stderr);
  const status = JSON.parse(result.stdout);
  assert.deepEqual(status, {
    accountAccessToken: "missing",
    accountRefreshToken: "missing",
    projectAccessToken: "missing",
    projectRefreshToken: "missing"
  });
});

test("linux ignores empty XDG_CONFIG_HOME and uses home config fallback", { skip: process.platform !== "linux" }, async () => {
  const { cwd, configDir } = await makeWorkspace();
  const homeDir = join(configDir, "home");
  const fallbackConfigDir = join(homeDir, ".config", "seliseblocks", "cli-os");
  await mkdir(fallbackConfigDir, { recursive: true });
  await writeConfig(fallbackConfigDir, {
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.seliseblocks.com",
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.seliseblocks.com",
        osUrl: "https://os.seliseblocks.com",
        rootTenantId: "root-tenant",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z"
      }
    }
  });

  const env = {
    ...process.env,
    BLOCKS_OS_SECRET_STORE: "file",
    HOME: homeDir,
    XDG_CONFIG_HOME: ""
  };
  delete env.BLOCKS_OS_CONFIG_DIR;

  const status = run(["doctor", "--json"], { cwd, env });
  assert.equal(status.status, 0, status.stderr);
  const data = JSON.parse(status.stdout);
  assert.ok(data.checks.some((check) => check.detail.includes(join(homeDir, ".config", "seliseblocks", "cli-os", "tokens.json"))));
});

test("parseFrontmatter extracts name and description from SKILL.md frontmatter", () => {
  const raw = [
    "---",
    "name: example-skill",
    "description: \"Line one with a colon: still one field.\"",
    "---",
    "",
    "# Body heading",
    "Body text."
  ].join("\n");

  const parsed = parseFrontmatter(raw);
  assert.equal(parsed.name, "example-skill");
  assert.equal(parsed.description, "Line one with a colon: still one field.");
  assert.match(parsed.body, /# Body heading/);
});

test("parseFrontmatter returns the raw text as body when there is no frontmatter block", () => {
  const parsed = parseFrontmatter("# Just a heading\nNo frontmatter here.");
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, undefined);
  assert.match(parsed.body, /Just a heading/);
});

test("listSkills reads every bundled blocks-skills entry with a name and description", async () => {
  const skills = await listSkills();
  assert.ok(skills.length > 0, "expected at least one bundled skill");
  assert.ok(skills.some((skill) => skill.name === "blocks-onboarding"));
  for (const skill of skills) {
    assert.ok(skill.name, `skill at ${skill.path} is missing a name`);
    assert.ok(skill.description, `skill '${skill.name}' is missing a description`);
  }
});

test("readSkill returns full content for a known skill and throws a helpful error for an unknown one", async () => {
  const skill = await readSkill("blocks-onboarding");
  assert.equal(skill.name, "blocks-onboarding");
  assert.match(skill.content, /^---/);

  await assert.rejects(() => readSkill("does-not-exist"), /Unknown skill 'does-not-exist'/);
});

test("skill:list and skill:add expose bundled blocks-skills content", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" });

  const list = run(["skill:list", "--json"], { cwd, env });
  assert.equal(list.status, 0, list.stderr);
  assert.ok(JSON.parse(list.stdout).some((skill) => skill.name === "blocks-onboarding"));

  const add = run(["skill:add", "blocks-onboarding"], { cwd, env });
  assert.equal(add.status, 0, add.stderr);
  const added = await readFile(join(cwd, "blocks-skills", "blocks-onboarding", "SKILL.md"), "utf8");
  assert.match(added, /^---/);

  const show = run(["skill:show", "does-not-exist"], { cwd, env });
  assert.equal(show.status, 1);
  assert.match(show.stderr, /Unknown skill 'does-not-exist'/);
});

test("sdk:client prints the resolved config and snippet without writing any files, when app-domain and client-id are both explicit", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_OS_SECRET_STORE: "file" });
  const flags = [
    "--x-blocks-key", "sdk-test-tenant",
    "--app-domain", "https://sdk-test.example.test",
    "--client-id", "sdk-test-client",
    "--blocks-api-url", "https://api.seliseblocks.com",
    "--oidc-url", "https://iam.seliseblocks.com"
  ];

  const jsonResult = run(["sdk:client", ...flags, "--json"], { cwd, env });
  assert.equal(jsonResult.status, 0, jsonResult.stderr);
  assert.deepEqual(JSON.parse(jsonResult.stdout), {
    apiUrl: "https://api.seliseblocks.com",
    appDomain: "https://sdk-test.example.test",
    notes: [],
    oidcClientId: "sdk-test-client",
    oidcUrl: "https://iam.seliseblocks.com",
    xBlocksKey: "sdk-test-tenant"
  });

  const snippetResult = run(["sdk:client", ...flags], { cwd, env });
  assert.equal(snippetResult.status, 0, snippetResult.stderr);
  assert.match(snippetResult.stdout, /createBlocksClient/);
  assert.match(snippetResult.stdout, /xBlocksKey: "sdk-test-tenant"/);

  const entries = await readdir(cwd);
  assert.deepEqual(entries, [], "sdk:client must not write any files");
});

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-cli-os-test-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { cwd, configDir };
}

async function writeConfig(configDir, config) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
}

async function writeSecretStore(configDir, store) {
  await writeFile(join(configDir, "secrets.json"), `${JSON.stringify(store, null, 2)}\n`);
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

async function withDevicePollingEnv(fn) {
  const { configDir } = await makeWorkspace();
  const originalConfigDir = process.env.BLOCKS_OS_CONFIG_DIR;
  const originalFetch = globalThis.fetch;
  process.env.BLOCKS_OS_CONFIG_DIR = configDir;

  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) delete process.env.BLOCKS_OS_CONFIG_DIR;
    else process.env.BLOCKS_OS_CONFIG_DIR = originalConfigDir;
  }
}

function deviceProfile(overrides = {}) {
  return {
    clientId: "client-id",
    oidcUrl: "https://iam.seliseblocks.com",
    rootTenantId: "root-tenant",
    ...overrides
  };
}

function deviceAuthorization(overrides = {}) {
  return {
    device_code: "device-code",
    expires_in: 30,
    interval: 5,
    user_code: "ABCD-EFGH",
    verification_uri: "https://iam.seliseblocks.com/device",
    ...overrides
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.`;
}

function run(args, { cwd, env }) {
  return spawnSync(process.execPath, [bin, ...args], {
    cwd,
    encoding: "utf8",
    env,
    timeout: 20_000
  });
}

function runAsync(args, { cwd, env }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [bin, ...args], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), 20_000);

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({
        signal,
        status,
        stderr: Buffer.concat(stderr).toString("utf8"),
        stdout: Buffer.concat(stdout).toString("utf8")
      });
    });
  });
}

function testEnv(configDir, extra = {}) {
  const env = {
    ...process.env,
    BLOCKS_OS_CONFIG_DIR: configDir,
    ...extra
  };

  if (!("BLOCKS_OS_SECRET_STORE" in extra)) delete env.BLOCKS_OS_SECRET_STORE;
  return env;
}

async function startJsonServer(handler) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    const body = text ? JSON.parse(text) : undefined;
    const result = handler(request, body);
    response.setHeader("content-type", "application/json");
    response.setHeader("connection", "close");
    response.end(JSON.stringify(result));
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  return {
    close: (callback) => {
      server.closeAllConnections();
      server.close(callback);
    },
    url: `http://127.0.0.1:${address.port}`
  };
}
