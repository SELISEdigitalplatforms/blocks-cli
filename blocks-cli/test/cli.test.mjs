import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";
import { applyAccountToken, applyProjectToken } from "../dist/lib/token.js";
import { writeConfig as writeConfigFile } from "../dist/lib/config.js";
import { readTokenStore, writeTokenStore } from "../dist/lib/token-store.js";
import {
  getAccountSession,
  getImpersonatedProjectSession,
  logoutCurrentSession,
  pollDeviceToken,
  requestDeviceAuthorization,
  stopProjectImpersonation,
  withAccountMode
} from "../dist/lib/auth.js";
import { withAuthTransitionLock } from "../dist/lib/auth-lock.js";
import { CliActionableError } from "../dist/lib/errors.js";
import { oidcRedirectUrisFromAppDomain } from "../dist/lib/domains.js";

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
  assert.equal(next.store.accounts.default.projects, undefined);
});

test("account token refresh does not change the active account", () => {
  const config = {
    activeAccount: "alpha",
    accounts: { alpha: {}, beta: {} }
  };
  const response = { access_token: fakeJwt({ tenant_id: "beta-root" }), expires_in: 3600 };

  const refreshed = applyAccountToken(config, { accounts: {} }, "beta", "client-id", response);
  const loggedIn = applyAccountToken(config, { accounts: {} }, "beta", "client-id", response, { activateAccount: true });

  assert.equal(refreshed.config.activeAccount, "alpha");
  assert.equal(loggedIn.config.activeAccount, "beta");
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
        account: {
          accessToken: "old-account-access-token",
          refreshToken: "old-account-refresh-token"
        },
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
  assert.equal(next.store.accounts.default.account, undefined);
  assert.deepEqual(Object.keys(next.store.accounts.default.projects), ["project-tenant"]);
  assert.equal(next.config, config);
});

test("project selection and deselection persist exactly one refreshable token pair", async () => {
  await withAuthLifecycleEnv(async ({ configDir }) => {
    const projectAccess = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "project-tenant" });
    const restoredAccountAccess = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" });
    await writeLifecycleAccount(configDir);
    globalThis.fetch = async (input) => {
      const path = new URL(input).pathname;
      if (path === "/iam/v4/auth/impersonate") {
        return jsonResponse({ access_token: projectAccess, expires_in: 3600, refresh_token: "project-refresh" });
      }
      if (path === "/iam/v4/auth/impersonation/stop") {
        return jsonResponse({ access_token: restoredAccountAccess, expires_in: 3600, refresh_token: "restored-account-refresh" });
      }
      return jsonResponse({ error: `Unexpected ${path}` }, 404);
    };

    await getImpersonatedProjectSession("default", "project-tenant");
    let store = await readTokenStore();
    assert.equal(store.accounts.default.account, undefined);
    assert.deepEqual(Object.keys(store.accounts.default.projects), ["project-tenant"]);

    // A command-level --project override can make the live token differ from
    // the saved selection; deselection must stop the live token session.
    await stopProjectImpersonation("default", "different-saved-project");
    store = await readTokenStore();
    assert.equal(store.accounts.default.projects, undefined);
    assert.equal(store.accounts.default.account.refreshToken, "restored-account-refresh");
  });
});

test("account-only operations stop and restore the previous project session", async () => {
  await withAuthLifecycleEnv(async ({ configDir }) => {
    await writeLifecycleProject(configDir);
    const calls = [];
    globalThis.fetch = async (input) => {
      const path = new URL(input).pathname;
      calls.push(path);
      if (path === "/iam/v4/auth/impersonation/stop") {
        return jsonResponse({
          access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
          expires_in: 3600,
          refresh_token: "account-after-stop"
        });
      }
      if (path === "/iam/v4/auth/impersonate") {
        return jsonResponse({
          access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "project-tenant" }),
          expires_in: 3600,
          refresh_token: "project-after-restore"
        });
      }
      if (path === "/api/oidc/token") {
        return jsonResponse({
          access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
          expires_in: 3600
        });
      }
      return jsonResponse({ error: `Unexpected ${path}` }, 404);
    };

    const transition = await withAccountMode("default", async (account) => {
      await getAccountSession(account.account, { forceRefresh: true });
      const during = await readTokenStore();
      assert.equal(account.accountTenant, "root-tenant");
      assert.equal(during.accounts.default.projects, undefined);
      assert.equal(during.accounts.default.account.refreshToken, "account-after-stop");
      return "created";
    });

    assert.equal(transition.result, "created");
    assert.equal(transition.previousProject, "project-tenant");
    assert.equal(transition.restoreError, undefined);
    assert.deepEqual(calls, ["/iam/v4/auth/impersonation/stop", "/api/oidc/token", "/iam/v4/auth/impersonate"]);
    const after = await readTokenStore();
    assert.equal(after.accounts.default.account, undefined);
    assert.equal(after.accounts.default.projects["project-tenant"].refreshToken, "project-after-restore");
  });
});

test("forced project refresh uses the project refresh token without an account session", async () => {
  await withAuthLifecycleEnv(async ({ configDir }) => {
    await writeLifecycleProject(configDir);
    let refreshBody;
    globalThis.fetch = async (input, init) => {
      const path = new URL(input).pathname;
      assert.equal(path, "/api/oidc/token");
      refreshBody = String(init.body);
      return jsonResponse({
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "project-tenant" }),
        expires_in: 3600
      });
    };

    await getImpersonatedProjectSession("default", "project-tenant", { forceRefresh: true });
    assert.match(refreshBody, /refresh_token=project-refresh/);
    const store = await readTokenStore();
    assert.equal(store.accounts.default.account, undefined);
    assert.equal(store.accounts.default.projects["project-tenant"].refreshToken, "project-refresh");
  });
});

test("project-mode logout revokes with the matching project access and refresh tokens", async () => {
  await withAuthLifecycleEnv(async ({ configDir }) => {
    await writeLifecycleProject(configDir);
    let authorization;
    let body;
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init.headers).get("authorization");
      body = JSON.parse(String(init.body));
      return jsonResponse({});
    };

    const result = await logoutCurrentSession("default", "project-tenant");
    assert.equal(result.hadTokens, true);
    assert.match(authorization, /^Bearer /);
    assert.equal(body.refresh_token, "project-refresh");
    assert.equal((await readTokenStore()).accounts.default, undefined);
  });
});

test("auth transitions are serialized within one config directory", async () => {
  await withAuthLifecycleEnv(async () => {
    let active = 0;
    let maximum = 0;
    const operation = () => withAuthTransitionLock(async () => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 80));
      active -= 1;
    });

    await Promise.all([operation(), operation()]);
    assert.equal(maximum, 1);
  });
});

test("account session refresh surfaces a clear next step when the identity provider rejects the refresh token", async () => {
  const { configDir } = await makeWorkspace();
  const originalConfigDir = process.env.BLOCKS_CONFIG_DIR;
  const originalSecretStore = process.env.BLOCKS_SECRET_STORE;
  const originalFetch = globalThis.fetch;

  process.env.BLOCKS_CONFIG_DIR = configDir;
  process.env.BLOCKS_SECRET_STORE = "file";
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
      assert.equal(error.nextStep, "blocks login");
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) delete process.env.BLOCKS_CONFIG_DIR;
    else process.env.BLOCKS_CONFIG_DIR = originalConfigDir;
    if (originalSecretStore === undefined) delete process.env.BLOCKS_SECRET_STORE;
    else process.env.BLOCKS_SECRET_STORE = originalSecretStore;
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
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  const server = await startJsonServer(() => ({ isOidcEnabled: true }));
  await writeProjectModeAuth(configDir, server.url, "test-tenant-key");

  try {
    const result = await runAsync([
      "new", "web", "demo-app",
      "--x-blocks-key", "test-tenant-key",
      "--app-domain", "https://demo.example.test",
      "--client-id", "demo-client-id",
      "--account", "studio",
      "--project", "test-tenant-key",
      "--api-url", server.url
    ], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  const appDir = join(cwd, "demo-app");
  const pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
  assert.ok(pkg.dependencies["@seliseblocks/client"], "expected a @seliseblocks/client dependency");
  assert.ok(pkg.devDependencies.selfsigned, "expected generated cert script to work without openssl");
  assert.equal(pkg.scripts["build:dev"], "vite build --mode dev && node scripts/write-release-env.mjs dev");
  assert.equal(pkg.scripts["build:prod"], "vite build --mode prod && node scripts/write-release-env.mjs prod");

  const files = await collectFiles(join(appDir, "src"));
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));
  const combined = contents.join("\n");

  assert.match(combined, /createBlocksClient/, "expected createBlocksClient to be used somewhere");
  assert.match(combined, /blocksClient\.auth\.idp\.redirectToProvider\(\)/, "login click should start through IdP initiate");
  assert.match(combined, /blocksClient\.auth\.idp\.callback\(callbackUrl\)/, "callback should complete through IdP callback");
  assert.match(combined, /blocksClient\.auth\.oidc\.refreshToken/, "refresh should use the SDK OIDC refresh helper");
  assert.match(combined, /blocksClient\.localization\.translations/, "expected localization modules to load through the Blocks client");
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

  const gitignore = await readFile(join(appDir, ".gitignore"), "utf8");
  assert.match(gitignore, /^\.env$/m);
  assert.match(gitignore, /^env\.\*$/m);

  const dockerfile = await readFile(join(appDir, "Dockerfile"), "utf8");
  assert.match(dockerfile, /FROM node:22-alpine AS builder/);
  assert.match(dockerfile, /if \[ -f package-lock\.json \]; then npm ci; else npm install; fi/);
  assert.match(dockerfile, /ARG ci_build=dev/);
  assert.match(dockerfile, /ARG VITE_BLOCKS_API_URL/);
  assert.match(dockerfile, /ARG VITE_BLOCKS_X_BLOCKS_KEY/);
  assert.match(dockerfile, /ARG VITE_BLOCKS_OIDC_CLIENT_ID/);
  assert.match(dockerfile, /ENV VITE_BLOCKS_API_URL=\$\{VITE_BLOCKS_API_URL\}/);
  assert.doesNotMatch(dockerfile, /cp \.env\.example \.env/);
  assert.match(dockerfile, /npx vite build --mode "\$\{ci_build\}"/);
  assert.match(dockerfile, /node scripts\/write-release-env\.mjs "\$\{ci_build\}"/);
  assert.match(dockerfile, /nginxinc\/nginx-unprivileged:1\.29-alpine/);

  const nginx = await readFile(join(appDir, "nginx.conf"), "utf8");
  assert.match(nginx, /listen 8080;/);
  assert.match(nginx, /try_files \$uri \$uri\/ \/index\.html;/);

  const envWriter = runNodeScript(["scripts/write-release-env.mjs", "dev"], { cwd: appDir, env });
  assert.equal(envWriter.status, 0, envWriter.stderr);
  const releaseEnv = await readFile(join(appDir, "dist", "env.dev"), "utf8");
  assert.match(releaseEnv, /^VITE_BLOCKS_API_URL=https:\/\/blocksapi\.example\.test$/m);
  assert.match(releaseEnv, /^VITE_BLOCKS_PROJECT_KEY=test-tenant-key$/m);
  assert.match(releaseEnv, /^VITE_BLOCKS_X_BLOCKS_KEY=test-tenant-key$/m);
  assert.match(releaseEnv, /^VITE_BLOCKS_REDIRECT_URI=https:\/\/demo\.example\.test\/login\/callback$/m);
  assert.match(releaseEnv, /^VITE_BLOCKS_HOSTED_LOGIN=true$/m);
  assert.doesNotMatch(releaseEnv, /^VITE_.*(SECRET|PTOK|JWT|TOKEN)=/m);

  const injectedEnvWriter = runNodeScript(["scripts/write-release-env.mjs", "prod"], {
    cwd: appDir,
    env: {
      ...env,
      VITE_BLOCKS_API_URL: "https://release-api.example.test",
      VITE_BLOCKS_APP_DOMAIN: "https://release.example.test",
      VITE_BLOCKS_OIDC_CLIENT_ID: "release-client-id",
      VITE_BLOCKS_X_BLOCKS_KEY: "release-tenant-key"
    }
  });
  assert.equal(injectedEnvWriter.status, 0, injectedEnvWriter.stderr);
  const injectedReleaseEnv = await readFile(join(appDir, "dist", "env.prod"), "utf8");
  assert.match(injectedReleaseEnv, /^VITE_BLOCKS_API_URL=https:\/\/release-api\.example\.test$/m);
  assert.match(injectedReleaseEnv, /^VITE_BLOCKS_PROJECT_KEY=release-tenant-key$/m);
  assert.match(injectedReleaseEnv, /^VITE_BLOCKS_OIDC_CLIENT_ID=release-client-id$/m);
  assert.match(injectedReleaseEnv, /^VITE_BLOCKS_REDIRECT_URI=https:\/\/release\.example\.test\/login\/callback$/m);

  await assert.rejects(() => readFile(join(appDir, "src/lib/blocks/http.ts"), "utf8"), /ENOENT/, "the generic Blocks fetch wrapper file should not be generated");

  assert.ok(files.some((file) => file.endsWith("ProfilePage.tsx")), "expected a Profile page");
  assert.ok(!files.some((file) => file.endsWith("DashboardPage.tsx")), "bootstrap should not scaffold a Dashboard page");
  assert.ok(!files.some((file) => file.endsWith("AssetsPage.tsx")), "bootstrap should not scaffold an Assets page");
  assert.ok(files.some((file) => file.endsWith("LocalizationProvider.tsx")), "expected a localization provider");
  assert.match(combined, /"\/":\s*ProfilePage/, "Profile should be the landing page ('/') on bootstrap");
  const commonDictionary = JSON.parse(await readFile(join(appDir, "blocks", "localization", "common.en.json"), "utf8"));
  assert.equal(commonDictionary.save, "Save");
  assert.equal(commonDictionary["common.save"], undefined);
  await assert.rejects(() => readFile(join(appDir, "blocks", "localization", "dashboard.en.json"), "utf8"), /ENOENT/, "bootstrap should not write a dashboard dictionary");
  await assert.rejects(() => readFile(join(appDir, "blocks", "localization", "assets.en.json"), "utf8"), /ENOENT/, "bootstrap should not write an assets dictionary");
  // Each SDK module is exercised in context rather than in one dedicated demo
  // panel: auth/localization are already covered above (idp login flow,
  // LocalizationProvider); iam is covered through the shared profile/user-menu query.
  assert.match(combined, /blocksClient\.iam\./, "expected an iam example");

  await assert.rejects(() => readFile(join(appDir, "src/lib/blocks/pkce.ts"), "utf8"), /ENOENT/, "the hosted IdP scaffold should not generate a local PKCE helper");
});

test("OIDC redirect URI defaults include production and local HTTPS callbacks", () => {
  assert.deepEqual(oidcRedirectUrisFromAppDomain("https://demo.example.test"), [
    "https://demo.example.test/login/callback",
    "https://demo.example.test:5173/login/callback"
  ]);
  assert.deepEqual(oidcRedirectUrisFromAppDomain("demo.example.test"), [
    "https://demo.example.test/login/callback",
    "https://demo.example.test:5173/login/callback"
  ]);
});

test("device authorization reads only the requested account's client secret", async () => {
  await withAuthLifecycleEnv(async ({ configDir }) => {
    const alpha = { ...testAccountProfile("root-tenant"), clientId: "shared-client", oidcUrl: "https://iam.example.test" };
    const beta = { ...alpha };
    await writeConfigFile({ activeAccount: "alpha", accounts: { alpha, beta } });
    await writeSecretStore(configDir, {
      accounts: {
        "client-secret:alpha": { clientSecret: "alpha-secret" },
        "client-secret:beta": { clientSecret: "beta-secret" }
      }
    });

    let submittedSecret;
    globalThis.fetch = async (_url, init) => {
      submittedSecret = init.body.get("client_secret");
      return jsonResponse(deviceAuthorization());
    };

    await requestDeviceAuthorization(beta, "beta");
    assert.equal(submittedSecret, "beta-secret");
  });
});

test("impersonation invalid-client recovery does not recommend an unusable auth-config command", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer(() => rawResponse(400, { error: "invalid_client" }));
  try {
    await writeConfig(configDir, {
      activeAccount: "alpha",
      accounts: { alpha: { ...testAccountProfile("alpha-root"), apiUrl: server.url } }
    });
    await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
      accounts: {
        alpha: {
          account: {
            accessToken: "account-access",
            accountTenant: "alpha-root",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            refreshToken: "account-refresh"
          }
        }
      }
    })}\n`);

    const result = await runAsync(["use", "target-project", "--account", "alpha", "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /register CLI client 'client-id'/);
    assert.doesNotMatch(result.stderr, /auth config get/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("fresh workspace dry-run commands do not require data files", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    accounts: {},
    selectedProject: { tenantId: "project-tenant" }
  });

  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const schema = run(["data:schema:push", "--dry-run", "--json"], { cwd, env });
  assert.equal(schema.status, 0, schema.stderr);
  assert.deepEqual(JSON.parse(schema.stdout), { dryRun: true, schemas: [] });

  const rules = run(["data:rules:deploy", "--dry-run", "--json"], { cwd, env });
  assert.equal(rules.status, 0, rules.stderr);
  assert.deepEqual(JSON.parse(rules.stdout), { dryRun: true, policies: 0, security: 0 });
});

test("oidc client provider registration defaults the discovery endpoint", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    accounts: {},
    selectedProject: { tenantId: "project-tenant" }
  });

  const result = run([
    "auth", "oidc-clients", "save",
    "--client-display-name", "Web App",
    "--client-type", "public",
    "--redirect-uris", "https://app.example.test/login/callback",
    "--scope", "openid profile",
    "--register-as-identity-provider",
    "--oidc-url", "https://iam.example.test",
    "--dry-run",
    "--json"
  ], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.request.registerAsIdentityProvider, true);
  assert.equal(output.request.externalDiscoveryEndpoint, "https://iam.example.test/project-tenant/.well-known/openid-configuration");
});

test("auth config save drops null current fields and only forces OIDC related fields", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const requests = [];
  const server = await startJsonServer((request, body) => {
    const path = request.url.split("?")[0];
    requests.push({ body, method: request.method, url: request.url });

    if (path === "/iam/v4/auth/config" && request.method === "GET") {
      return {
        itemId: "507f1f77bcf86cd799439011",
        refreshTokenValidForNumberMinutes: 1440,
        absoluteRefreshTokenValidForNumberMinutes: null,
        accessTokenValidForNumberMinutes: 60,
        rememberMeRefreshTokenValidForNumberMinutes: null,
        getNumberOfWrongAttemptsToLockTheAccount: 5,
        accountLockDurationInMinutes: 30,
        publicCertificatePath: null,
        accountActivationPath: "activate/",
        accountVerificationPath: "verify/",
        recoverAccountPath: "recover/",
        isOidcEnabled: false,
        accountActionBaseUrl: "https://app.example.test",
        useAccountActionBaseUrlAsDefault: true,
        activationUrlLifetimeInMinutes: null,
        recoverAccountUrlLifetimeInMinutes: null,
        logoutOnPasswordChange: true,
        passwordStrengthCheckerRegex: null
      };
    }

    if (path === "/iam/v4/auth/config" && request.method === "POST") {
      return { data: body, isSuccess: true };
    }

    return rawResponse(500, { errorMessage: `Unexpected ${request.method} ${path}` });
  });

  try {
    const result = await runAsync(["auth", "config", "save", "--oidc-enabled", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const saveRequest = requests.find((item) => item.method === "POST" && item.url === "/iam/v4/auth/config");
    assert.ok(saveRequest, JSON.stringify(requests));
    assert.deepEqual(saveRequest.body, {
      itemId: "507f1f77bcf86cd799439011",
      refreshTokenValidForNumberMinutes: 1440,
      accessTokenValidForNumberMinutes: 60,
      getNumberOfWrongAttemptsToLockTheAccount: 5,
      accountLockDurationInMinutes: 30,
      accountActivationPath: "oidc/activate/",
      accountVerificationPath: "verify/",
      recoverAccountPath: "recover/",
      isOidcEnabled: true,
      accountActionBaseUrl: "https://app.example.test",
      useAccountActionBaseUrlAsDefault: true,
      logoutOnPasswordChange: true
    });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("auth config dry-run fails when enabling OIDC without an account action base URL", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const requests = [];
  const server = await startJsonServer((request) => {
    requests.push({ method: request.method, url: request.url });
    return { isOidcEnabled: false };
  });

  try {
    const result = await runAsync([
      "auth", "config", "save", "--oidc-enabled", "--dry-run", "--api-url", server.url, "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires accountActionBaseUrl/);
    assert.equal(requests.filter((item) => item.method === "POST").length, 0);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("auth config explicit false survives fetch-and-merge", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const server = await startJsonServer(() => ({ accountActionBaseUrl: "https://app.example.test", isOidcEnabled: true }));
  try {
    const result = await runAsync([
      "auth", "config", "save", "--oidc-enabled=false", "--dry-run", "--api-url", server.url, "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).request.isOidcEnabled, false);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("iam me prefers project auth only when a project is resolved", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const authorizations = [];
  const server = await startJsonServer((request) => {
    authorizations.push(request.headers.authorization);
    return { itemId: "user-1" };
  });

  try {
    await writeProjectAuth(configDir);
    let result = await runAsync(["iam", "me", "--project", "project-tenant", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(authorizations.at(-1), `Bearer ${fakeJwt({ tenant_id: "project-tenant" })}`);

    await writeProjectAuth(configDir, { accountOnly: true });
    result = await runAsync(["iam", "me", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(authorizations.at(-1), `Bearer ${fakeJwt({ tenant_id: "root-tenant" })}`);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("space-separated complex command aliases resolve like colon commands", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  const args = [
    "data", "validation", "save",
    "--schema-id", "schema-1",
    "--field-name", "postalCode",
    "--body", JSON.stringify({ validations: [{ type: 1, value: "^[0-9]{5}$", isActive: true }] }),
    "--dry-run",
    "--json"
  ];

  const result = run(args, { cwd, env });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.endpoint, "/data/v4/data-validations");
  assert.deepEqual(output.request, {
    fieldName: "postalCode",
    schemaId: "schema-1",
    validations: [{ type: 1, value: "^[0-9]{5}$", isActive: true }]
  });
});

test("rich JSON payload commands let scalar flags override body fields without dropping arrays", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  const result = run([
    "data:validation:save",
    "--body", JSON.stringify({
      fieldName: "email",
      itemId: "validation-1",
      schemaId: "schema-from-body",
      validations: [
        { errorMessage: "Digits only", isActive: true, type: 1, value: "^[0-9]+$" },
        { isActive: false, type: 2, value: "legacy" }
      ]
    }),
    "--schema-id", "schema-from-flag",
    "--dry-run",
    "--json"
  ], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.request.schemaId, "schema-from-flag");
  assert.equal(output.request.fieldName, "email");
  assert.equal(output.request.itemId, "validation-1");
  assert.equal(output.request.validations.length, 2);
});

test("iam roles list sends zero-based backend page and omits empty sort", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    return { data: [], totalCount: 0 };
  });

  try {
    const result = await runAsync([
      "iam:roles:list",
      "--page", "1",
      "--page-size", "10",
      "--api-url", server.url,
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(requests[0].url, "/iam/v4/iam/roles");
    assert.equal(requests[0].body.page, 0);
    assert.equal(requests[0].body.pageSize, 10);
    assert.ok(!("sort" in requests[0].body));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("iam permissions list sends sort only with a property", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    return { data: [], totalCount: 0 };
  });

  try {
    const result = await runAsync([
      "iam:permissions:list",
      "--sort-by", "Name",
      "--sort-desc",
      "--api-url", server.url,
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(requests[0].url, "/iam/v4/iam/permissions");
    assert.equal(requests[0].body.page, 0);
    assert.deepEqual(requests[0].body.sort, { isDescending: true, property: "Name" });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("iam roles assign-permissions resolves resource strings and sends organizationId", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    if (request.url === "/iam/v4/iam/permissions") {
      return {
        data: [
          { itemId: "perm-add-id", resource: "orders::read" },
          { itemId: "perm-remove-id", resource: "orders::delete" }
        ]
      };
    }
    return { isSuccess: true, success: true };
  });

  try {
    const result = await runAsync([
      "iam:roles:assign-permissions",
      "manager",
      "--add-permissions", "orders::read,existing-id",
      "--remove-permissions", "orders::delete",
      "--organization-id", "org-1",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(requests.map((item) => item.url), [
      "/iam/v4/iam/permissions",
      "/iam/v4/iam/permissions",
      "/iam/v4/iam/roles/assign-permissions"
    ]);
    assert.deepEqual(requests[2].body, {
      addPermissions: ["perm-add-id", "existing-id"],
      organizationId: "org-1",
      removePermissions: ["perm-remove-id"],
      slug: "manager"
    });
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("data schema aggregation rejects page zero before network calls", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    return { data: {} };
  });

  try {
    const result = run([
      "data:schema:aggregation",
      "--page", "0",
      "--api-url", server.url,
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--page must be greater than or equal to 1/);
    assert.deepEqual(requests, []);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema push ignores a foreign local id and creates via POST when no destination schema exists", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  await mkdir(join(cwd, "blocks", "data", "schemas"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "schemas", "Company.json"), `${JSON.stringify({
    collectionName: "sb_Companys",
    fields: [{ name: "Name", type: "String" }],
    itemId: "foreign-project-id",
    schemaName: "Company",
    schemaType: 1
  }, null, 2)}\n`);

  const requests = [];
  const server = await startJsonServer((request, body) => {
    const path = request.url.split("?")[0];
    requests.push({ body, method: request.method, url: request.url });
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [], totalCount: 0 }, isSuccess: true };
    }
    if (path === "/data/v4/schemas/define" && request.method === "POST") {
      return { data: { acknowledged: true, itemId: "new-id" }, isSuccess: true };
    }
    return rawResponse(500, { errorMessage: `Unexpected ${request.method} ${path}` });
  });

  try {
    const result = await runAsync(["data:schema:push", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.results.length, 1);
    assert.ok(output.warnings?.[0]?.includes("ignoring local id"), JSON.stringify(output));

    const defineRequest = requests.find((item) => item.url.startsWith("/data/v4/schemas/define"));
    assert.equal(defineRequest.method, "POST");
    assert.equal(defineRequest.body.itemId, undefined);
    assert.equal(defineRequest.body.id, undefined);
    assert.equal(defineRequest.body.schemaName, "Company");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema push uses the destination project's own id and PUT when a schema with that name already exists", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  await mkdir(join(cwd, "blocks", "data", "schemas"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "schemas", "Company.json"), `${JSON.stringify({
    collectionName: "sb_Companys",
    fields: [{ name: "Name", type: "String" }],
    itemId: "foreign-project-id",
    schemaName: "Company",
    schemaType: 1
  }, null, 2)}\n`);

  const requests = [];
  const server = await startJsonServer((request, body) => {
    const path = request.url.split("?")[0];
    requests.push({ body, method: request.method, url: request.url });
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [{ id: "destination-id", schemaName: "Company" }], totalCount: 1 }, isSuccess: true };
    }
    if (path === "/data/v4/schemas/define" && request.method === "PUT") {
      return { data: { acknowledged: true, itemId: "destination-id" }, isSuccess: true };
    }
    return rawResponse(500, { errorMessage: `Unexpected ${request.method} ${path}` });
  });

  try {
    const result = await runAsync(["data:schema:push", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.warnings, undefined);

    const defineRequest = requests.find((item) => item.url.startsWith("/data/v4/schemas/define"));
    assert.equal(defineRequest.method, "PUT");
    assert.equal(defineRequest.body.itemId, "destination-id");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema push fails clearly instead of treating a 204 empty response as success", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  await mkdir(join(cwd, "blocks", "data", "schemas"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "schemas", "Company.json"), `${JSON.stringify({
    collectionName: "sb_Companys",
    fields: [{ name: "Name", type: "String" }],
    schemaName: "Company",
    schemaType: 1
  }, null, 2)}\n`);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [{ id: "destination-id", schemaName: "Company" }], totalCount: 1 }, isSuccess: true };
    }
    if (path === "/data/v4/schemas/define" && request.method === "PUT") {
      return rawResponse(204);
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:schema:push", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Company/);
    assert.match(result.stderr, /empty response/);
    assert.ok(!result.stdout.includes("null"), result.stdout);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema pull writes a canonical portable file with no server id or system-managed fields", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  // data:validate also requires a rules file to exist; write an empty one so this test
  // isolates schema-file validation (the point of the pull-to-validate-to-push check).
  await mkdir(join(cwd, "blocks", "data"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "rules.json"), `${JSON.stringify({ policies: [], security: [] }, null, 2)}\n`);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return {
        data: {
          items: [{
            collectionName: "sb_Companys",
            fields: [
              { isArray: false, isPIIData: false, isUniqueData: false, name: "Name", type: "String" },
              { name: "ItemId", type: "String" },
              { name: "CreatedDate", type: "DateTime" }
            ],
            id: "server-id",
            mutationSchemas: ["insertCompany", "updateCompany", "deleteCompany"],
            projectKey: "project-tenant",
            querySchema: "Companys",
            readAccessLevel: 0,
            schemaName: "Company",
            schemaType: 1,
            totalReadPolicies: 0
          }],
          totalCount: 1
        },
        isSuccess: true
      };
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:schema:pull", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(await readFile(join(cwd, "blocks", "data", "schemas", "Company.json"), "utf8"));
    assert.deepEqual(written, {
      collectionName: "sb_Companys",
      fields: [{ isArray: false, isPIIData: false, isUniqueData: false, name: "Name", type: "String" }],
      schemaName: "Company",
      schemaType: 1
    });

    const validate = run(["data:validate", "--json"], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });
    assert.equal(validate.status, 0, validate.stderr);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema pull tolerates a nested legacy response wrapper", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return {
        data: {
          data: { items: [{ collectionName: "sb_Companys", id: "server-id", schemaName: "Company", schemaType: 1 }], totalCount: 1 },
          isSuccess: true
        },
        isSuccess: true
      };
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:schema:pull", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.count, 1);
    const written = JSON.parse(await readFile(join(cwd, "blocks", "data", "schemas", "Company.json"), "utf8"));
    assert.equal(written.id, undefined);
    assert.equal(written.schemaName, "Company");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema pull fetches every page when more schemas exist than one page returns", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const pageRequests = [];
  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      const params = new URL(request.url, "http://x").searchParams;
      const pageNo = params.get("PageNo");
      pageRequests.push(pageNo);
      if (pageNo === "1") {
        return { data: { items: [{ collectionName: "sb_Companys", id: "id-1", schemaName: "Company", schemaType: 1 }], totalCount: 2 }, isSuccess: true };
      }
      return { data: { items: [{ collectionName: "sb_Contacts", id: "id-2", schemaName: "Contact", schemaType: 1 }], totalCount: 2 }, isSuccess: true };
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:schema:pull", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(pageRequests, ["1", "2"]);
    const output = JSON.parse(result.stdout);
    assert.equal(output.count, 2);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema list validates the response envelope and rejects a malformed shape instead of treating it as empty", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const goodServer = await startJsonServer(() => ({ data: { items: [], totalCount: 0 }, isSuccess: true }));
  try {
    const good = await runAsync(["data:schema:list", "--page", "1", "--page-size", "50", "--api-url", goodServer.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(good.status, 0, good.stderr);
    assert.deepEqual(JSON.parse(good.stdout), { data: { items: [], totalCount: 0 }, isSuccess: true });
  } finally {
    await new Promise((resolveClose) => goodServer.close(resolveClose));
  }

  const malformedServer = await startJsonServer(() => ({ isSuccess: false, message: "boom" }));
  try {
    const malformed = await runAsync(["data:schema:list", "--api-url", malformedServer.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /Blocks API returned an unsuccessful response: boom/);
  } finally {
    await new Promise((resolveClose) => malformedServer.close(resolveClose));
  }
});

test("rules pull stores the policy list from response.data in the CLI's portable schemaName-based format", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [{ collectionName: "sb_Companys", id: "schema-id", schemaName: "Company", schemaType: 1 }], totalCount: 1 }, isSuccess: true };
    }
    if (path === "/data/v4/data-access/policy/get" && request.method === "GET") {
      return {
        data: [{
          entityName: "Company",
          fieldNames: [],
          isAllowPolicy: true,
          itemId: "policy-1",
          operation: 0,
          policyDescription: "",
          policyName: "OwnerOnly",
          policyType: 0,
          priority: 0,
          ruleGroup: { logicalOperator: 0, nestedGroups: [], rules: [] },
          schemaId: "schema-id"
        }],
        isSuccess: true
      };
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:rules:pull", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(await readFile(join(cwd, "blocks", "data", "rules.json"), "utf8"));
    assert.equal(written.policies.length, 1);
    assert.equal(written.policies[0].schemaName, "Company");
    assert.equal(written.policies[0].policyName, "OwnerOnly");
    assert.equal(written.policies[0].itemId, undefined);
    assert.equal(written.policies[0].schemaId, undefined);
    assert.equal(written.policies[0].entityName, undefined);
    assert.equal(written.isSuccess, undefined, "must not store the raw service envelope");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("rules pull falls back to the queried schema name when the API's entityName comes back empty", async () => {
  // Observed against a live project: policy/get returns entityName: "" instead of
  // the schema name, so pull must not silently drop the schema association.
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [{ collectionName: "sb_AcceptanceTests", id: "schema-id", schemaName: "AcceptanceTest", schemaType: 1 }], totalCount: 1 }, isSuccess: true };
    }
    if (path === "/data/v4/data-access/policy/get" && request.method === "GET") {
      return {
        data: [{
          entityName: "",
          fieldNames: [],
          isAllowPolicy: true,
          itemId: "policy-1",
          operation: 0,
          policyDescription: "",
          policyName: "OwnerOnlyRead",
          policyType: 0,
          priority: 0,
          ruleGroup: { logicalOperator: 0, nestedGroups: [], rules: [] },
          schemaId: "schema-id"
        }],
        isSuccess: true
      };
    }
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:rules:pull", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const written = JSON.parse(await readFile(join(cwd, "blocks", "data", "rules.json"), "utf8"));
    assert.equal(written.policies[0].schemaName, "AcceptanceTest");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("rules deploy resolves the destination schema id by name instead of reusing a source-project id", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  await mkdir(join(cwd, "blocks", "data"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "rules.json"), `${JSON.stringify({
    policies: [{
      fieldNames: [],
      isAllowPolicy: true,
      operation: 0,
      policyDescription: "",
      policyName: "OwnerOnly",
      policyType: 0,
      priority: 0,
      ruleGroup: { logicalOperator: 0, nestedGroups: [], rules: [] },
      schemaName: "Company"
    }],
    security: []
  }, null, 2)}\n`);

  const requests = [];
  const server = await startJsonServer((request, body) => {
    const path = request.url.split("?")[0];
    requests.push({ body, method: request.method, url: request.url });
    if (path === "/data/v4/schemas" && request.method === "GET") {
      return { data: { items: [{ collectionName: "sb_Companys", id: "destination-schema-id", schemaName: "Company", schemaType: 1 }], totalCount: 1 }, isSuccess: true };
    }
    if (path === "/data/v4/data-access/policy/get" && request.method === "GET") {
      return { data: [], isSuccess: true };
    }
    if (path === "/data/v4/data-access/policy/create" && request.method === "POST") {
      return { data: { acknowledged: true, itemId: "new-policy-id" }, isSuccess: true };
    }
    return rawResponse(500, { errorMessage: `Unexpected ${request.method} ${path}` });
  });

  try {
    const result = await runAsync(["data:rules:deploy", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(result.status, 0, result.stderr);
    const createRequest = requests.find((item) => item.url.startsWith("/data/v4/data-access/policy/create"));
    assert.ok(createRequest, JSON.stringify(requests));
    assert.equal(createRequest.body.schemaId, "destination-schema-id");
    assert.equal(createRequest.body.schemaName, "Company");
    assert.equal(createRequest.body.policyName, "OwnerOnly");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("rules deploy fails clearly when a policy targets a schema missing from the destination project", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);
  await mkdir(join(cwd, "blocks", "data"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "rules.json"), `${JSON.stringify({
    policies: [{ policyName: "OwnerOnly", schemaName: "Ghost" }],
    security: []
  }, null, 2)}\n`);

  const server = await startJsonServer((request) => {
    const path = request.url.split("?")[0];
    if (path === "/data/v4/schemas" && request.method === "GET") return { data: { items: [], totalCount: 0 }, isSuccess: true };
    if (path === "/data/v4/data-access/policy/get" && request.method === "GET") return { data: [], isSuccess: true };
    return rawResponse(500);
  });

  try {
    const result = await runAsync(["data:rules:deploy", "--yes", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Ghost/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("schema get prints exact GraphQL operation names in human output while leaving --json untouched", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir);

  const schemaResponse = {
    data: {
      collectionName: "sb_Companys",
      id: "server-id",
      mutationSchemas: ["insertCompany", "updateCompany", "deleteCompany"],
      querySchema: "Companys",
      schemaName: "Company",
      schemaType: 1
    },
    isSuccess: true
  };
  const server = await startJsonServer(() => schemaResponse);

  try {
    const jsonResult = await runAsync(["data:schema:get", "server-id", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(jsonResult.status, 0, jsonResult.stderr);
    assert.deepEqual(JSON.parse(jsonResult.stdout), schemaResponse);

    const humanResult = await runAsync(["data:schema:get", "server-id", "--api-url", server.url], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(humanResult.status, 0, humanResult.stderr);
    assert.match(humanResult.stdout, /getCompanys/);
    assert.match(humanResult.stdout, /insertManyCompany/);
    assert.match(humanResult.stdout, /updateManyCompany/);
    assert.match(humanResult.stdout, /deleteManyCompany/);
    assert.match(humanResult.stdout, /insertCompany/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("notifier notify dry-run parses comma lists and JSON array flags", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  const subscriptionFilters = [
    { actionName: "created", context: "orders", value: "*" },
    { actionName: "paid", context: "orders", value: "true" }
  ];

  const result = run([
    "notifier", "notify",
    "--roles", "admin, manager , ,ops",
    "--user-ids", "u1,u2",
    "--subscription-filters", JSON.stringify(subscriptionFilters),
    "--denormalized-payload", JSON.stringify({ orderId: "A-100" }),
    "--save-denormalized-payload-as-object",
    "--content-available",
    "--dry-run",
    "--json"
  ], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.endpoint, "/logic/v4/Notifier/Notify");
  assert.deepEqual(output.request.roles, ["admin", "manager", "ops"]);
  assert.deepEqual(output.request.userIds, ["u1", "u2"]);
  assert.deepEqual(output.request.subscriptionFilters, subscriptionFilters);
  assert.equal(output.request.saveDenormalizedPayloadAsAnObject, true);
  assert.equal(output.request.contentAvailable, true);
});

test("secret-bearing command dry-runs redact secrets while preserving typed fields", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run([
    "mail:config:save",
    "--name", "primary",
    "--host", "smtp.example.test",
    "--port", "587",
    "--enable-ssl",
    "--sender-name", "Blocks",
    "--sender-address", "noreply@example.test",
    "--account-password", "super-secret",
    "--dry-run",
    "--json"
  ], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.endpoint, "/os/v4/Mail/Save");
  assert.equal(output.request.accountPassword, "***");
  assert.equal(output.request.configurationName, "primary");
  assert.equal(output.request.enableSSL, true);
  assert.equal(output.request.port, 587);
  assert.doesNotMatch(result.stdout, /super-secret/);
});

test("user and identity-provider dry-runs recursively redact secrets", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const user = run([
    "iam", "users", "create", "--email", "user@example.test", "--password", "user-secret", "--dry-run", "--json"
  ], { cwd, env });
  assert.equal(user.status, 0, user.stderr);
  assert.equal(JSON.parse(user.stdout).request.password, "***");
  assert.doesNotMatch(user.stdout, /user-secret/);

  for (const command of ["create", "update"]) {
    const args = ["auth", "idp", command];
    if (command === "update") args.push("provider-1");
    args.push(
      "--body", JSON.stringify({
        clientId: "public-client",
        clientSecret: "client-secret-value",
        privateKey: "private-key-value",
        protocol: "oidc",
        provider: "apple",
        providerType: "apple"
      }),
      "--dry-run", "--json"
    );
    const result = run(args, { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const request = JSON.parse(result.stdout).request;
    assert.equal(request.clientSecret, "***");
    assert.equal(request.privateKey, "***");
    assert.doesNotMatch(result.stdout, /client-secret-value|private-key-value/);
  }
});

test("configuration boolean flags preserve explicit false values", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  const cases = [
    [["iam", "organizations", "config", "save", "--multi-org-enabled=false", "--dry-run", "--json"], "isMultiOrgEnabled"],
    [["iam", "signup-settings", "save", "--email-password-signup=false", "--dry-run", "--json"], "isEmailPasswordSignUpEnabled"],
    [["mfa", "config", "save", "--enable=false", "--dry-run", "--json"], "enableMfa"],
    [["mail", "config", "save", "--enable-ssl=false", "--dry-run", "--json"], "enableSSL"]
  ];

  for (const [args, field] of cases) {
    const result = run(args, { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).request[field], false);
  }
});

test("mfa method set supports guarded dry-run", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const result = run(["mfa", "method", "set", "1", "--dry-run", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    dryRun: true,
    endpoint: "/iam/v4/mfa/method",
    request: { mfaType: 1 }
  });
});

test("composed commands forward explicit account project and API context", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ authorization: request.headers.authorization, body, url: request.url });
    return { ok: true };
  });

  try {
    await writeTwoAccountProjectAuth(configDir, server.url);
    const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
    const context = ["--account", "alpha", "--project", "target-project", "--api-url", server.url, "--yes"];

    const mfa = await runAsync(["mfa", "totp", "enable", "--mfa-type", "1", "--code", "123456", ...context], { cwd, env });
    assert.equal(mfa.status, 0, mfa.stderr);
    assert.deepEqual(requests.map((item) => item.url.split("?")[0]), [
      "/iam/v4/mfa/totp/setup",
      "/iam/v4/mfa/totp/verify-setup",
      "/iam/v4/mfa/method",
      "/iam/v4/mfa/backup-codes/generate"
    ]);
    assert.ok(requests.every((item) => item.authorization === "Bearer alpha-target-token"));

    requests.length = 0;
    const localization = await runAsync([
      "localization", "key", "translate-and-export", "--module-id", "module-1", "--output-type", "1", ...context
    ], { cwd, env });
    assert.equal(localization.status, 0, localization.stderr);
    assert.deepEqual(requests.map((item) => item.url.split("?")[0]), [
      "/localization/v4/Key/TranslateAll",
      "/localization/v4/Key/GenerateUilmFile",
      "/localization/v4/Key/UilmExport"
    ]);
    assert.ok(requests.every((item) => item.authorization === "Bearer alpha-target-token"));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("release deploy wait polls with the explicitly deployed project session", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const requests = [];
  const server = await startJsonServer((request) => {
    requests.push({ authorization: request.headers.authorization, method: request.method, url: request.url });
    const path = request.url.split("?")[0];
    if (path === "/os/v4/Project/Gets") {
      return [{ tenantGroupId: "group-1", projects: [{ environment: "dev", tenantId: "target-project" }] }];
    }
    if (path === "/os/v4/Project/GetAsset") {
      return { assets: { resources: [{ name: "dev", resourceId: "repo-1" }] } };
    }
    if (path === "/release/v4/api/Build/repo-details") {
      return { data: { repo: { branch: "dev", repoUrl: "https://example.test/repo.git" } } };
    }
    if (path === "/release/v4/api/Build/manual") return { buildId: "build-1" };
    if (path === "/release/v4/api/Build") return { status: "completed" };
    return rawResponse(500, { error: `Unexpected ${request.method} ${path}` });
  });

  try {
    await writeTwoAccountProjectAuth(configDir, server.url);
    const result = await runAsync([
      "release", "deploy", "--account", "alpha", "--project", "target-project", "--api-url", server.url,
      "--yes", "--wait", "--poll-interval", "0", "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });
    assert.equal(result.status, 0, result.stderr);
    const poll = requests.find((item) => item.url.startsWith("/release/v4/api/Build?buildId="));
    assert.ok(poll, JSON.stringify(requests));
    assert.equal(poll.authorization, "Bearer alpha-target-token");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("composed data file upload dry-run plans metadata creation and provider PUT", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run([
    "data", "files", "upload",
    "--file", "invoice.pdf",
    "--parent-id", "folder-1",
    "--tags", "finance,2026",
    "--access-modifier", "Public",
    "--module-name", "3",
    "--dry-run",
    "--json"
  ], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.dryRun, true);
  assert.deepEqual(output.steps.map((step) => step.endpoint), [
    "/data/v4/files/get-pre-signed-url-for-upload",
    "PUT <uploadUrl>"
  ]);
  assert.deepEqual(output.steps[0].body, {
    accessModifier: "Public",
    moduleName: 3,
    name: "invoice.pdf",
    parentDirectoryId: "folder-1",
    tags: "finance,2026"
  });
  assert.equal(output.steps[1].contentType, "application/pdf");
});

test("current storage commands dry-run object-tree mutations with safe delete defaults", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const softDelete = run(["data", "files", "delete", "file-1", "--dry-run", "--json"], { cwd, env });
  assert.equal(softDelete.status, 0, softDelete.stderr);
  assert.deepEqual(JSON.parse(softDelete.stdout), {
    dryRun: true,
    endpoint: "/data/v4/files/delete-file",
    request: { fileId: "file-1", permanent: false }
  });

  const directory = run([
    "data", "files", "directory-create", "Contracts",
    "--parent-id", "dir-1",
    "--allowed-extensions", "pdf,docx",
    "--dry-run", "--json"
  ], { cwd, env });
  assert.equal(directory.status, 0, directory.stderr);
  assert.deepEqual(JSON.parse(directory.stdout).request, {
    allowedFileExtensions: ["pdf", "docx"],
    name: "Contracts",
    parentDirectoryId: "dir-1"
  });

  const access = run([
    "data", "files", "access-grant", "dir-1",
    "--resource-type", "Directory",
    "--principal-type", "Role",
    "--principal-id", "editors",
    "--permission", "Edit",
    "--dry-run", "--json"
  ], { cwd, env });
  assert.equal(access.status, 0, access.stderr);
  assert.equal(JSON.parse(access.stdout).endpoint, "/data/v4/objects/grant-access");
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.file, join("blocks", "localization", "common.en.json"));
  assert.equal(output.keys, 2);
  assert.equal(output.valid, true);
});

test("localization validate rejects keys redundantly prefixed with the module name", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await mkdir(join(cwd, "blocks", "localization"), { recursive: true });
  await writeFile(join(cwd, "blocks", "localization", "dashboard.en.json"), `${JSON.stringify({
    "dashboard.title": "Dashboard"
  }, null, 2)}\n`);

  const result = run(["localization:validate", "--module", "dashboard", "--language", "en", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /Redundant module prefix in key 'dashboard\.title'/);
  assert.match(result.stderr, /use 'title'/);
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
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

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

  const result = run(["--version"], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), pkg.version);
});

test("explicit account uses only the requested account", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "alpha",
    accounts: {
      alpha: testAccountProfile("alpha-root"),
      beta: testAccountProfile("beta-root")
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      alpha: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "alpha-root" }),
          accountTenant: "alpha-root",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        }
      },
      beta: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) - 3600, tenant_id: "beta-root" }),
          accountTenant: "beta-root",
          expiresAt: new Date(Date.now() - 3_600_000).toISOString()
        }
      }
    }
  }, null, 2)}\n`);

  const result = run(["auth:status", "--account", "beta", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).accountAccessToken, "expired");
});

test("missing account flag uses active account from the resolved config store", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "beta",
    accounts: {
      alpha: testAccountProfile("alpha-root"),
      beta: testAccountProfile("beta-root")
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      alpha: {},
      beta: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "beta-root" }),
          accountTenant: "beta-root",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        }
      }
    }
  }, null, 2)}\n`);

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).accountAccessToken, "valid");
});

test("requested missing account never falls back to active account", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "alpha",
    accounts: { alpha: testAccountProfile("alpha-root") }
  });

  const result = run(["auth:status", "--account", "missing", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "account_not_configured");
  assert.match(error.message, /current config store/);
});

test("project flag overrides workspace and stored project without changing either selection", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({ project: { tenantId: "workspace-project" } }, null, 2)}\n`);
  await writeAuthContext(configDir, "alpha", "stored-project", {
    "override-project": fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "override-project" })
  });
  const requests = [];
  const server = await startJsonServer((request) => {
    requests.push(request);
    return [{
      name: "Override",
      projects: [{ environment: "dev", name: "Override", tenantId: "override-project" }],
      tenantGroupId: "group-1"
    }];
  });

  try {
    const result = await runAsync([
      "projects:get", "--project", "override-project", "--api-url", server.url, "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.match(requests[0].headers.authorization, /^Bearer /);
    assert.equal(JSON.parse(await readFile(join(configDir, "config.json"), "utf8")).accounts.alpha.selectedProject.tenantId, "stored-project");
    assert.equal(JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8")).project.tenantId, "workspace-project");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("accounts in the same config store keep independent selected projects", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const alphaToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "alpha", tenant_id: "alpha-project" });
  const betaToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "beta", tenant_id: "beta-project" });
  await writeConfig(configDir, {
    activeAccount: "alpha",
    accounts: {
      alpha: { ...testAccountProfile("alpha-root"), selectedProject: { tenantId: "alpha-project" } },
      beta: { ...testAccountProfile("beta-root"), selectedProject: { tenantId: "beta-project" } }
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      alpha: {
        account: { accountTenant: "alpha-root" },
        projects: { "alpha-project": { accessToken: alphaToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }
      },
      beta: {
        account: { accountTenant: "beta-root" },
        projects: { "beta-project": { accessToken: betaToken, expiresAt: new Date(Date.now() + 3_600_000).toISOString() } }
      }
    }
  }, null, 2)}\n`);
  const authorizations = [];
  const server = await startJsonServer((request) => {
    authorizations.push(request.headers.authorization);
    return [];
  });

  try {
    const alpha = await runAsync(["projects:list", "--account", "alpha", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    const beta = await runAsync(["projects:list", "--account", "beta", "--api-url", server.url, "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(alpha.status, 0, alpha.stderr);
    assert.equal(beta.status, 0, beta.stderr);
    assert.deepEqual(authorizations, [`Bearer ${alphaToken}`, `Bearer ${betaToken}`]);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("use and deselect operate on the account selected by login without account flags", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer((request) => {
    if (request.url === "/iam/v4/auth/impersonate") {
      return {
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "active-project" }),
        expires_in: 3600,
        refresh_token: "active-project-refresh"
      };
    }
    if (request.url === "/iam/v4/auth/impersonation/stop") {
      return {
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "active-account-root" }),
        expires_in: 3600,
        refresh_token: "restored-account-refresh"
      };
    }
    return rawResponse(404, { error: `Unexpected ${request.url}` });
  });
  await writeConfig(configDir, {
    activeAccount: "active-account",
    accounts: {
      "active-account": {
        ...testAccountProfile("active-account-root"),
        apiUrl: server.url
      }
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      "active-account": {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "active-account-root" }),
          accountTenant: "active-account-root",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          refreshToken: "active-account-refresh"
        }
      }
    }
  }, null, 2)}\n`);
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
  try {
    const useResult = await runAsync(["use", "active-project"], { cwd, env });
    assert.equal(useResult.status, 0, useResult.stderr);
    let config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8"));
    assert.equal(config.activeAccount, "active-account");
    assert.equal(config.accounts["active-account"].selectedProject.tenantId, "active-project");

    const deselectResult = await runAsync(["deselect"], { cwd, env });
    assert.equal(deselectResult.status, 0, deselectResult.stderr);
    config = JSON.parse(await readFile(join(configDir, "config.json"), "utf8"));
    assert.equal(config.activeAccount, "active-account");
    assert.equal(config.accounts["active-account"].selectedProject, undefined);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("BLOCKS_CONFIG_DIR isolates active account and token state", async () => {
  const first = await makeWorkspace();
  const second = await makeWorkspace();
  await writeAuthContext(first.configDir, "alpha");
  await writeConfig(second.configDir, {
    activeAccount: "beta",
    accounts: { beta: testAccountProfile("beta-root") }
  });

  const firstStatus = run(["auth:status", "--json"], {
    cwd: first.cwd,
    env: testEnv(first.configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  const secondStatus = run(["auth:status", "--json"], {
    cwd: second.cwd,
    env: testEnv(second.configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(firstStatus.status, 0, firstStatus.stderr);
  assert.equal(secondStatus.status, 0, secondStatus.stderr);
  assert.equal(JSON.parse(firstStatus.stdout).accountAccessToken, "valid");
  assert.equal(JSON.parse(secondStatus.stdout).accountAccessToken, "missing");
});

test("two config directories can use the same project with different accounts", async () => {
  const first = await makeWorkspace();
  const second = await makeWorkspace();
  const firstProjectToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "alpha-user", tenant_id: "shared-project" });
  const secondProjectToken = fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, sub: "beta-user", tenant_id: "shared-project" });
  await writeAuthContext(first.configDir, "alpha", "shared-project", { "shared-project": firstProjectToken });
  await writeAuthContext(second.configDir, "beta", "shared-project", { "shared-project": secondProjectToken });
  const authorizations = [];
  const server = await startJsonServer((request) => {
    authorizations.push(request.headers.authorization);
    return [];
  });

  try {
    const firstResult = await runAsync(["projects:list", "--api-url", server.url, "--json"], {
      cwd: first.cwd,
      env: testEnv(first.configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    const secondResult = await runAsync(["projects:list", "--api-url", server.url, "--json"], {
      cwd: second.cwd,
      env: testEnv(second.configDir, { BLOCKS_SECRET_STORE: "file" })
    });

    assert.equal(firstResult.status, 0, firstResult.stderr);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.deepEqual(authorizations, [`Bearer ${firstProjectToken}`, `Bearer ${secondProjectToken}`]);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("non-interactive missing context fails clearly without prompting", async () => {
  const missingAccount = await makeWorkspace();
  await writeConfig(missingAccount.configDir, {
    activeAccount: "removed",
    accounts: { available: testAccountProfile("available-root") }
  });
  const accountResult = run(["projects:list", "--json"], {
    cwd: missingAccount.cwd,
    env: testEnv(missingAccount.configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  assert.equal(accountResult.status, 1);
  assert.equal(JSON.parse(accountResult.stderr).code, "account_not_selected");

  const missingProject = await makeWorkspace();
  await writeAuthContext(missingProject.configDir, "alpha");
  const projectResult = run(["data:config:get", "--json"], {
    cwd: missingProject.cwd,
    env: testEnv(missingProject.configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  assert.equal(projectResult.status, 1);
  assert.equal(JSON.parse(projectResult.stderr).code, "project_not_selected");
});

test("fresh auth status hides packaged account defaults", async () => {
  const { cwd, configDir } = await makeWorkspace();

  const result = run(["auth:status", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });

  assert.equal(result.status, 0, result.stderr);
  const blocksConfig = JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8"));
  const envExample = await readFile(join(cwd, ".env.example"), "utf8");
  assert.equal(blocksConfig.project.apiUrl, "https://api.seliseblocks.com");
  assert.match(envExample, /^VITE_BLOCKS_API_URL=https:\/\/api\.seliseblocks\.com$/m);
});

test("new web derives the default API URL from the app domain when no API override is passed", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer(() => ({ isOidcEnabled: true }));
  try {
    await writeProjectModeAuth(configDir, server.url);
    const result = await runAsync([
      "new", "web", "dev-app",
      "--x-blocks-key", "project-tenant",
      "--app-domain", "https://dqrsf.slsblx.com",
      "--client-id", "dev-client-id",
      "--account", "studio",
      "--project", "project-tenant",
      "--api-url", server.url
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    const envFile = await readFile(join(cwd, "dev-app", ".env"), "utf8");
    assert.match(envFile, /^VITE_BLOCKS_API_URL=https:\/\/blocksapi\.slsblx\.com$/m);
    assert.match(envFile, /^VITE_BLOCKS_OIDC_URL=https:\/\/iam\.seliseblocks\.com$/m);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("new web preserves an explicit blocks API URL override", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer(() => ({ isOidcEnabled: true }));
  try {
    await writeProjectModeAuth(configDir, server.url);
    const result = await runAsync([
      "new", "web", "override-app",
      "--x-blocks-key", "project-tenant",
      "--app-domain", "https://dqrsf.slsblx.com",
      "--blocks-api-url", "https://api.override.example.test",
      "--client-id", "dev-client-id",
      "--account", "studio",
      "--project", "project-tenant",
      "--api-url", server.url
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    const envFile = await readFile(join(cwd, "override-app", ".env"), "utf8");
    assert.match(envFile, /^VITE_BLOCKS_API_URL=https:\/\/api\.override\.example\.test$/m);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("new web fails closed non-interactively unless OIDC enablement is approved", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const requests = [];
  const server = await startJsonServer((request, body) => {
    requests.push({ body, method: request.method, url: request.url });
    if (request.method === "GET") return { accountActionBaseUrl: "", isOidcEnabled: false };
    return { data: body, isSuccess: true };
  });

  try {
    await writeProjectModeAuth(configDir, server.url);
    const baseArgs = [
      "new", "web", "guarded-app", "--x-blocks-key", "project-tenant",
      "--app-domain", "https://app.example.test", "--client-id", "dev-client-id",
      "--account", "studio", "--project", "project-tenant", "--api-url", server.url
    ];
    const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });
    const rejected = await runAsync(baseArgs, { cwd, env });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /Confirmation required in non-interactive mode/);
    await assert.rejects(readFile(join(cwd, "guarded-app", ".env"), "utf8"), /ENOENT/);
    assert.equal(requests.filter((item) => item.method === "POST").length, 0);

    const approved = await runAsync([...baseArgs, "--yes"], { cwd, env });
    assert.equal(approved.status, 0, approved.stderr);
    const save = requests.find((item) => item.method === "POST");
    assert.ok(save);
    assert.equal(save.body.isOidcEnabled, true);
    assert.equal(save.body.accountActionBaseUrl, "https://iam.seliseblocks.com");
    await readFile(join(cwd, "guarded-app", ".env"), "utf8");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("new web fails fast when non-interactive input is missing", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer(() => []);

  try {
    await writeProjectModeAuth(configDir, server.url);
    const result = await runAsync([
      "new", "web", "prompted-app",
      "--x-blocks-key", "project-tenant",
      "--app-domain", "https://app.example.test",
      "--account", "studio",
      "--project", "project-tenant",
      "--api-url", server.url,
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).code, "interactive_input_required");
    await assert.rejects(readFile(join(cwd, "prompted-app", ".env"), "utf8"), /ENOENT/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("service failure envelopes exit nonzero even when HTTP status is 200", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startJsonServer(() => ({ isSuccess: false, message: "mutation rejected" }));

  try {
    await writeProjectModeAuth(configDir, server.url);
    const result = await runAsync([
      "notification", "list",
      "--account", "studio",
      "--project", "project-tenant",
      "--api-url", server.url,
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 1);
    assert.match(JSON.parse(result.stderr).message, /unsuccessful response: mutation rejected/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
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
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");

  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "not_logged_in");
  assert.equal(error.nextStep, "blocks login, then blocks projects list, then blocks use <tenantId>");
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
  const fallbackConfigDir = join(homeDir, ".config", "seliseblocks", "cli");
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
    BLOCKS_SECRET_STORE: "file",
    HOME: homeDir,
    XDG_CONFIG_HOME: ""
  };
  delete env.BLOCKS_CONFIG_DIR;

  const status = run(["doctor", "--json"], { cwd, env });
  assert.equal(status.status, 0, status.stderr);
  const data = JSON.parse(status.stdout);
  assert.ok(data.checks.some((check) => check.detail.includes(join(homeDir, ".config", "seliseblocks", "cli", "tokens.json"))));
});

test("removed skill and sdk helper commands are not exposed", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  for (const command of [["skill", "list"], ["skill:list"], ["sdk", "client"], ["sdk:client"]]) {
    const result = run(command, { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown command/);
  }
});

test("projects create dry-runs a single dev application with the terms accepted", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run(["projects", "create", "Acme Shop", "--dry-run", "--json"], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.endpoint, "/os/v4/Project/Create");
  assert.equal(output.request.name, "Acme Shop");
  assert.equal(output.request.isAcceptBlocksTerms, true);
  assert.equal(output.request.isUseBlocksExclusively, true);
  assert.equal(output.request.isProduction, false);
  assert.deepEqual(output.request.resources, []);
  assert.ok(!("tenantGroupId" in output.request));
  assert.equal(output.request.applicationContexts.length, 1);
  assert.equal(output.request.applicationContexts[0].environment, "dev");
  assert.equal(output.request.applicationContexts[0].cookieDomain, "slsblx.com");
  assert.match(output.request.applicationContexts[0].domain, /^https:\/\/d[a-z]{5}\.slsblx\.com$/);
});

test("projects create cannot be widened past one dev environment", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run([
    "projects", "create", "Acme Shop",
    "--env", "prod",
    "--production",
    "--domain", "https://custom.example.test",
    "--cookie-domain", "example.test",
    "--tenant-group-id", "existing-group",
    "--dry-run",
    "--json"
  ], { cwd, env });

  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.request.isProduction, false);
  assert.ok(!("tenantGroupId" in output.request));
  assert.deepEqual(output.request.applicationContexts.map((context) => context.environment), ["dev"]);
  assert.notEqual(output.request.applicationContexts[0].domain, "https://custom.example.test");
  assert.equal(output.request.applicationContexts[0].cookieDomain, "slsblx.com");
});

test("projects create rejects a name the backend validator would reject", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run(["projects", "create", "ab", "--yes", "--json"], { cwd, env });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /between 3 and 100 characters/);
});

test("projects create fails loudly on a 200 response carrying isSuccess false", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir, { accountOnly: true });
  const server = await startJsonServer((request) => {
    if (request.url?.startsWith("/os/v4/Project/Gets")) return [];
    return { errors: { Name: "Project Name must be between 3 and 100 characters." }, isSuccess: false };
  });

  try {
    const result = await runAsync([
      "projects", "create", "Acme Shop",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /Project\/Create rejected 'Acme Shop'/);
    assert.match(result.stderr, /Name: Project Name must be between 3 and 100 characters./);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("projects create refuses a duplicate project name unless allowed", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir, { accountOnly: true });
  const requests = [];
  const server = await startJsonServer((request) => {
    requests.push(request.url);
    if (request.url?.startsWith("/os/v4/Project/Gets")) {
      return [{ name: "Acme Shop", projects: [{ environment: "dev", tenantId: "Dgroup-1" }], tenantGroupId: "group-1" }];
    }
    return { isSuccess: true, tenantGroupId: "group-2" };
  });

  try {
    const result = await runAsync([
      "projects", "create", "acme shop",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 1, result.stdout);
    assert.match(result.stderr, /already exists on this account/);
    assert.ok(!requests.some((url) => url === "/os/v4/Project/Create"));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("projects create names the positional form when no name is given", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run(["projects", "create", "--dry-run", "--json"], { cwd, env });

  assert.equal(result.status, 1);
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, "missing_project_name");
  assert.equal(error.nextStep, 'blocks projects create "<name>"');
});

test("projects create --allow-duplicate-name skips the name lookup entirely", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir, { accountOnly: true });
  const urls = [];
  const server = await startJsonServer((request) => {
    urls.push(request.url);
    if (request.url?.startsWith("/os/v4/Project/Gets")) {
      return [{
        name: "Acme Shop",
        projects: [{ applications: [{ domain: "https://dzzzzz.slsblx.com" }], environment: "dev", name: "Acme Shop", tenantId: "Dgroup-2" }],
        tenantGroupId: "group-2"
      }];
    }
    return { errors: null, isSuccess: true, tenantGroupId: "group-2" };
  });

  try {
    const result = await runAsync([
      "projects", "create", "Acme Shop",
      "--allow-duplicate-name",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).tenantId, "Dgroup-2");
    // The only Project/Gets calls are the post-create verification ones.
    assert.equal(urls[0], "/os/v4/Project/Create");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("projects create verifies the new dev tenant against Project/Gets", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeProjectAuth(configDir, { accountOnly: true });
  const created = [];
  const server = await startJsonServer((request, body) => {
    if (request.url?.startsWith("/os/v4/Project/Gets")) {
      if (created.length === 0) return [];
      return [{
        name: "Acme Shop",
        projects: [{
          applications: [{ domain: "https://dabcde.slsblx.com" }],
          environment: "dev",
          name: "Acme Shop",
          tenantId: "Dgroup-1"
        }],
        tenantGroupId: "group-1"
      }];
    }

    created.push(body);
    return { errors: null, isSuccess: true, tenantGroupId: "group-1" };
  });

  try {
    const result = await runAsync([
      "projects", "create", "Acme Shop",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      domain: "https://dabcde.slsblx.com",
      environment: "dev",
      name: "Acme Shop",
      tenantGroupId: "group-1",
      tenantId: "Dgroup-1",
      verified: true
    });
    assert.equal(created.length, 1);
    assert.equal(created[0].applicationContexts.length, 1);
    assert.equal(created[0].applicationContexts[0].environment, "dev");
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("doctor inspects cached auth state without refreshing or rewriting it", async () => {
  const { cwd, configDir } = await makeWorkspace();
  let networkCalls = 0;
  const server = await startJsonServer(() => {
    networkCalls++;
    return { access_token: "unexpected-refresh" };
  });

  try {
    await writeConfig(configDir, {
      activeAccount: "default",
      accounts: {
        default: {
          ...testAccountProfile("root-tenant"),
          oidcUrl: server.url,
          selectedProject: { tenantId: "project-tenant" }
        }
      }
    });
    await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
      accounts: {
        default: {
          account: {
            accessToken: "expired-account-token",
            accountTenant: "root-tenant",
            expiresAt: new Date(Date.now() - 60_000).toISOString(),
            refreshToken: "account-refresh"
          },
          projects: {
            "project-tenant": {
              accessToken: "valid-project-token",
              expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
              refreshToken: "project-refresh"
            }
          }
        }
      }
    })}\n`);
    await writeSecretStore(configDir, { accounts: {} });

    const result = await runAsync(["doctor", "--account", "default", "--json"], {
      cwd,
      env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(networkCalls, 0);
    assert.equal(JSON.parse(result.stdout).ok, true);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("doctor accepts a healthy account-only session without a selected project", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeConfig(configDir, {
    activeAccount: "default",
    accounts: { default: testAccountProfile("root-tenant") }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      default: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
          accountTenant: "root-tenant",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          refreshToken: "account-refresh"
        }
      }
    }
  })}\n`);
  await writeSecretStore(configDir, { accounts: {} });

  const result = run(["doctor", "--account", "default", "--json"], {
    cwd,
    env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" })
  });
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.ok, true);
  assert.ok(output.checks.some((check) => check.label === "Project context" && /account-only mode/.test(check.detail)));
});

test("projects create stops and restores an active project session", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const calls = [];
  const server = await startJsonServer((request) => {
    const path = request.url?.split("?")[0];
    calls.push(path);
    if (path === "/iam/v4/auth/impersonation/stop") {
      return {
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
        expires_in: 3600,
        refresh_token: "account-after-stop"
      };
    }
    if (path === "/os/v4/Project/Create") return { errors: null, isSuccess: true, tenantGroupId: "new-group" };
    if (path === "/os/v4/Project/Gets") {
      return [{
        name: "New Project",
        projects: [{ environment: "dev", name: "New Project", tenantId: "Dnew-group" }],
        tenantGroupId: "new-group"
      }];
    }
    if (path === "/iam/v4/auth/impersonate") {
      return {
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "project-tenant" }),
        expires_in: 3600,
        refresh_token: "restored-project-refresh"
      };
    }
    return rawResponse(404, { error: `Unexpected ${path}` });
  });
  await writeProjectModeAuth(configDir, server.url);

  try {
    const result = await runAsync([
      "projects", "create", "New Project",
      "--allow-duplicate-name",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, `${result.stderr}\nCalls: ${calls.join(", ")}`);
    assert.deepEqual(calls, [
      "/iam/v4/auth/impersonation/stop",
      "/os/v4/Project/Create",
      "/os/v4/Project/Gets",
      "/iam/v4/auth/impersonate"
    ]);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

test("projects create reports restoration failure without retrying a successful create", async () => {
  const { cwd, configDir } = await makeWorkspace();
  let creates = 0;
  const server = await startJsonServer((request) => {
    const path = request.url?.split("?")[0];
    if (path === "/iam/v4/auth/impersonation/stop") {
      return {
        access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
        expires_in: 3600,
        refresh_token: "account-after-stop"
      };
    }
    if (path === "/os/v4/Project/Create") {
      creates += 1;
      return { errors: null, isSuccess: true, tenantGroupId: "new-group" };
    }
    if (path === "/os/v4/Project/Gets") {
      return [{
        name: "New Project",
        projects: [{ environment: "dev", name: "New Project", tenantId: "Dnew-group" }],
        tenantGroupId: "new-group"
      }];
    }
    if (path === "/iam/v4/auth/impersonate") return rawResponse(500, { error: "restore failed" });
    return rawResponse(404, { error: `Unexpected ${path}` });
  });
  await writeProjectModeAuth(configDir, server.url);

  try {
    const result = await runAsync([
      "projects", "create", "New Project",
      "--allow-duplicate-name",
      "--api-url", server.url,
      "--yes",
      "--json"
    ], { cwd, env: testEnv(configDir, { BLOCKS_SECRET_STORE: "file" }) });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(creates, 1);
    assert.match(result.stderr, /was created, but project session 'project-tenant' could not be restored/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-cli-test-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { cwd, configDir };
}

async function writeConfig(configDir, config) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify(config, null, 2)}\n`);
}

function testAccountProfile(rootTenantId) {
  return {
    apiUrl: "https://api.example.test",
    clientId: "client-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test",
    osUrl: "https://api.example.test",
    rootTenantId,
    scope: "openid profile offline_access",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

async function writeAuthContext(configDir, accountName, selectedProject, projectTokens = {}) {
  const rootTenantId = `${accountName}-root`;
  await writeConfig(configDir, {
    activeAccount: accountName,
    accounts: {
      [accountName]: {
        ...testAccountProfile(rootTenantId),
        selectedProject: selectedProject ? { tenantId: selectedProject } : undefined
      }
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      [accountName]: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: rootTenantId }),
          accountTenant: rootTenantId,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        },
        projects: Object.fromEntries(Object.entries(projectTokens).map(([tenantId, accessToken]) => [tenantId, {
          accessToken,
          expiresAt: new Date(Date.now() + 3_600_000).toISOString()
        }]))
      }
    }
  }, null, 2)}\n`);
}

async function writeProjectAuth(configDir, { accountOnly = false } = {}) {
  await writeConfig(configDir, {
    accounts: {
      default: {
        apiUrl: "https://api.example.test",
        clientId: "client-id",
        oidcUrl: "https://iam.example.test",
        rootTenantId: "root-tenant"
      }
    },
    selectedProject: accountOnly ? undefined : { tenantId: "project-tenant" }
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
        projects: accountOnly ? undefined : {
          "project-tenant": {
            accessToken: fakeJwt({ tenant_id: "project-tenant" }),
            accountTenant: "root-tenant",
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            refreshToken: "project-refresh-token",
            tokenType: "Bearer"
          }
        }
      }
    }
  }, null, 2)}\n`);
}

async function writeSecretStore(configDir, store) {
  await writeFile(join(configDir, "secrets.json"), `${JSON.stringify(store, null, 2)}\n`);
}

async function writeProjectModeAuth(configDir, apiUrl, tenantId = "project-tenant") {
  await writeConfig(configDir, {
    activeAccount: "studio",
    accounts: {
      studio: {
        ...testAccountProfile("root-tenant"),
        apiUrl,
        selectedProject: { tenantId }
      }
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      studio: {
        projects: {
          [tenantId]: {
            accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: tenantId }),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            refreshToken: "project-refresh"
          }
        }
      }
    }
  }, null, 2)}\n`);
}

async function writeTwoAccountProjectAuth(configDir, apiUrl) {
  await writeConfig(configDir, {
    activeAccount: "beta",
    accounts: {
      alpha: {
        ...testAccountProfile("alpha-root"),
        apiUrl,
        selectedProject: { tenantId: "stored-project" }
      },
      beta: {
        ...testAccountProfile("beta-root"),
        apiUrl,
        selectedProject: { tenantId: "beta-project" }
      }
    }
  });
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: {
      alpha: {
        projects: {
          "stored-project": { accessToken: "alpha-stored-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
          "target-project": { accessToken: "alpha-target-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }
        }
      },
      beta: {
        projects: {
          "beta-project": { accessToken: "beta-project-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() }
        }
      }
    }
  }, null, 2)}\n`);
}

async function withAuthLifecycleEnv(operation) {
  const { configDir } = await makeWorkspace();
  const originalConfigDir = process.env.BLOCKS_CONFIG_DIR;
  const originalSecretStore = process.env.BLOCKS_SECRET_STORE;
  const originalFetch = globalThis.fetch;
  process.env.BLOCKS_CONFIG_DIR = configDir;
  process.env.BLOCKS_SECRET_STORE = "file";

  try {
    await operation({ configDir });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) delete process.env.BLOCKS_CONFIG_DIR;
    else process.env.BLOCKS_CONFIG_DIR = originalConfigDir;
    if (originalSecretStore === undefined) delete process.env.BLOCKS_SECRET_STORE;
    else process.env.BLOCKS_SECRET_STORE = originalSecretStore;
  }
}

async function writeLifecycleAccount(configDir) {
  await writeLifecycleConfig(configDir);
  await writeTokenStore({
    accounts: {
      default: {
        account: {
          accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "root-tenant" }),
          accountTenant: "root-tenant",
          expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          refreshToken: "account-refresh",
          tokenType: "Bearer"
        }
      }
    }
  });
}

async function writeLifecycleProject(configDir) {
  await writeLifecycleConfig(configDir);
  await writeTokenStore({
    accounts: {
      default: {
        projects: {
          "project-tenant": {
            accessToken: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 3600, tenant_id: "project-tenant" }),
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
            refreshToken: "project-refresh",
            tokenType: "Bearer"
          }
        }
      }
    }
  });
}

async function writeLifecycleConfig(configDir) {
  await writeConfigFile({
    activeAccount: "default",
    accounts: {
      default: {
        apiUrl: "https://api.example.test",
        clientId: "client-id",
        oidcUrl: "https://iam.example.test",
        rootTenantId: "root-tenant",
        selectedProject: { tenantId: "project-tenant" },
        scope: "openid profile offline_access"
      }
    }
  });
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name));
}

async function withDevicePollingEnv(fn) {
  const { configDir } = await makeWorkspace();
  const originalConfigDir = process.env.BLOCKS_CONFIG_DIR;
  const originalFetch = globalThis.fetch;
  process.env.BLOCKS_CONFIG_DIR = configDir;

  try {
    await fn();
  } finally {
    globalThis.fetch = originalFetch;
    if (originalConfigDir === undefined) delete process.env.BLOCKS_CONFIG_DIR;
    else process.env.BLOCKS_CONFIG_DIR = originalConfigDir;
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

/** For use as a startJsonServer handler return value: a non-200 status, optionally with a JSON body. */
function rawResponse(status, body) {
  return body === undefined ? { __httpStatus: status } : { __httpBody: body, __httpStatus: status };
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

function runNodeScript(args, { cwd, env }) {
  return spawnSync(process.execPath, args, {
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
    BLOCKS_CONFIG_DIR: configDir,
    ...extra
  };

  if (!("BLOCKS_SECRET_STORE" in extra)) delete env.BLOCKS_SECRET_STORE;
  return env;
}

async function startJsonServer(handler) {
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    const body = text ? JSON.parse(text) : undefined;
    const result = handler(request, body);
    response.setHeader("connection", "close");

    // A handler can return `rawResponse(status[, body])` to simulate a non-200
    // status and/or an empty body (e.g. the backend's HTTP 204 "not found").
    if (result && typeof result === "object" && "__httpStatus" in result) {
      response.statusCode = result.__httpStatus;
      if ("__httpBody" in result) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify(result.__httpBody));
      } else {
        response.end();
      }
      return;
    }

    response.setHeader("content-type", "application/json");
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

test("help index lists every registered command without the full text help", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const index = run(["--help", "--json"], { cwd, env });
  assert.equal(index.status, 0, index.stderr);
  const parsed = JSON.parse(index.stdout);
  const listed = Object.values(parsed.families).flat();
  assert.equal(parsed.commandCount, listed.length);

  const full = run(["--help"], { cwd, env });
  assert.ok(
    index.stdout.length * 3 < full.stdout.length,
    `index (${index.stdout.length}B) should be far smaller than the text help (${full.stdout.length}B)`
  );
});

test("help resolves one command's flags without running it", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const result = run(["help", "mail", "mailbox", "list", "--json"], { cwd, env });
  assert.equal(result.status, 0, result.stderr);
  const entry = JSON.parse(result.stdout);
  assert.equal(entry.name, "mail mailbox list");
  assert.equal(entry.scope, "project");
  assert.equal(entry.mutating, false);
  // the flag list is derived from source, so a stale doc example cannot survive here
  assert.ok(entry.flags.includes("page-number"));
  assert.ok(!entry.flags.includes("configuration-id"));
});

test("help never executes the command it describes", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  // 'login --help' would perform a real device login; 'help login' must not.
  const result = run(["help", "login"], { cwd, env });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /blocks login/);
  assert.doesNotMatch(result.stdout, /Authorize this device|Waiting for approval/);
});

test("help reports scope and mutation from source, not prose", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const me = JSON.parse(run(["help", "iam", "me", "--json"], { cwd, env }).stdout);
  assert.equal(me.scope, "project-or-account");

  const create = JSON.parse(run(["help", "projects", "create", "--json"], { cwd, env }).stdout);
  assert.equal(create.scope, "account");
  assert.equal(create.mutating, true);

  // object-tree.ts exports 23 handlers from one file; scoping must be per-handler
  const resolve = JSON.parse(run(["help", "data", "files", "access-resolve", "--json"], { cwd, env }).stdout);
  assert.equal(resolve.mutating, false);
  assert.ok(resolve.flags.length < 5, `expected a narrow flag list, got ${resolve.flags.length}`);
});

test("help falls back to a family and fails clearly on an unknown target", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir, { BLOCKS_SECRET_STORE: "file" });

  const family = JSON.parse(run(["help", "mfa", "backup-codes", "--json"], { cwd, env }).stdout);
  assert.equal(family.family, "mfa backup-codes");
  assert.equal(family.commands.length, 3);

  const unknown = run(["help", "nope", "--json"], { cwd, env });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown_help_target/);
});
