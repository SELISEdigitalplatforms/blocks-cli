import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

const SNAPSHOT_FOLDERS = ["iam", "auth", "mail", "storage", "release", "logic"];

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-pull-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

async function writeProjectAuth(configDir, apiUrl) {
  const profile = {
    apiUrl, clientId: "client-id", createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test", osUrl: apiUrl, rootTenantId: "alpha-root",
    scope: "openid", updatedAt: "2026-01-01T00:00:00.000Z"
  };
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    activeAccount: "alpha",
    accounts: { alpha: { ...profile, selectedProject: { tenantId: "target-project" } } }
  }, null, 2)}\n`);
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "t", expiresAt: new Date(Date.now() + 3e6).toISOString() } } } }
  }, null, 2)}\n`);
}

function testEnv(configDir) {
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_OPEN_BROWSER: "0" };
}

function run(args, { cwd, env }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = []; const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.stdout.on("data", (c) => stdout.push(c));
    child.stderr.on("data", (c) => stderr.push(c));
    child.on("close", (status) => {
      clearTimeout(timer);
      resolveRun({ status, stderr: Buffer.concat(stderr).toString("utf8"), stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

// 150 roles, so the 100-per-page pull has to fetch a second page.
const ROLES = Array.from({ length: 150 }, (_, index) => ({ itemId: `role-${index}`, name: `Role ${index}` }));

async function startServer({ failRelease = false } = {}) {
  const requests = [];
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const url = new URL(request.url, "http://localhost");
    const body = bodyText ? JSON.parse(bodyText) : {};
    requests.push({ method: request.method, path: url.pathname, body, query: Object.fromEntries(url.searchParams) });

    let status = 200;
    let result;
    switch (`${request.method} ${url.pathname}`) {
      case "POST /iam/v4/iam/roles":
        result = { data: ROLES.slice(body.page * body.pageSize, (body.page + 1) * body.pageSize), isSuccess: true, totalCount: ROLES.length };
        break;
      case "POST /iam/v4/iam/permissions":
        result = { data: [{ itemId: "perm-1", name: "read" }], isSuccess: true, totalCount: 1 };
        break;
      case "GET /iam/v4/iam/resource-groups":
        result = [{ name: "billing" }];
        break;
      case "GET /iam/v4/iam/resource/features":
        result = [{ name: "reports" }];
        break;
      case "GET /iam/v4/auth/config":
        result = { allowSignup: true };
        break;
      case "GET /iam/v4/oidc-clients":
        result = [{ client_id: "web", clientSecret: "oidc-secret-value" }];
        break;
      case "GET /iam/v4/auth/identity-providers":
        result = [{ name: "google", clientSecret: "idp-secret-value" }];
        break;
      case "GET /os/v4/Mail/Gets":
        result = [{ itemId: "mail-1", accountPassword: "smtp-password" }];
        break;
      case "GET /os/v4/Mail/GetTemplates":
        result = { templates: Number(url.searchParams.get("PageNumber")) === 0 ? [{ name: "welcome" }] : [], totalCount: 1 };
        break;
      case "GET /os/v4/Storage/Gets":
        result = [{ name: "s3", accessKey: "AKIA", secretKey: "s3-secret", sftpSecretKey: "sftp-secret", password: "pw", connectionString: "cs" }];
        break;
      case "GET /release/v4/Build/repos-list":
        if (failRelease) { status = 500; result = { message: "boom" }; }
        else result = { data: [{ repoId: "repo-1", repoName: "web", branch: "main" }] };
        break;
      case "GET /logic/v4/Proxies":
        result = { data: [{ itemId: "px-1", upstream: "https://api.example.test?key=raw", upstreamMasked: "https://api.example.test?key=***" }], isSuccess: true, totalCount: 1 };
        break;
      case "POST /logic/v4/Scheduler/GetSchedules":
        result = { data: [{ itemId: "sch-1", webhook: { signingSecret: "sign" } }], isSuccess: true, totalCount: 1 };
        break;
      case "POST /logic/v4/Functions/GetAll":
        result = { data: [{ id: "fn-1", name: "orders", status: "Live", isDirty: false }], totalCount: 1 };
        break;
      default:
        status = 404;
        result = { message: `unexpected ${request.method} ${url.pathname}` };
    }
    response.statusCode = status;
    response.setHeader("connection", "close");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return {
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    requests,
    url: `http://127.0.0.1:${port}`
  };
}

const ctx = (url) => ["--account", "alpha", "--api-url", url, "--json"];

async function writeWorkspaceConfig(cwd, tenantId = "target-project") {
  await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({ project: { tenantId } }, null, 2)}\n`);
}

test("init writes the full blocks/ tree and never overwrites it", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir);

  const first = await run(["init", "--json"], { cwd, env });
  assert.equal(first.status, 0, first.stderr);
  const created = JSON.parse(first.stdout).created;
  for (const path of ["blocks/data/rules.json", "blocks/data/README.md", "blocks/localization/README.md", "blocks/workflows/README.md"]) {
    assert.ok(created.includes(path), `missing ${path}`);
  }
  for (const folder of SNAPSHOT_FOLDERS) {
    assert.ok(created.includes(`blocks/${folder}/README.md`), `missing blocks/${folder}/README.md`);
    assert.match(await readFile(join(cwd, "blocks", folder, "README.md"), "utf8"), /Read-only snapshot/);
  }
  assert.ok((await stat(join(cwd, "blocks", "data", "schemas"))).isDirectory());
  assert.deepEqual((await readJson(join(cwd, "blocks.json"))).localization, { dictionaries: "blocks/localization" });

  await writeFile(join(cwd, "blocks", "iam", "README.md"), "edited\n");
  const second = await run(["init", "--json"], { cwd, env });
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(second.stdout).created, []);
  assert.equal(await readFile(join(cwd, "blocks", "iam", "README.md"), "utf8"), "edited\n");
});

test("pull writes a redacted, _meta-stamped snapshot for every service", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeWorkspaceConfig(cwd);
    await mkdir(join(cwd, "sub"));

    // Run from a subdirectory: the snapshot still lands next to blocks.json.
    const result = await run(["pull", ...ctx(server.url)], { cwd: join(cwd, "sub"), env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.failed, []);
    assert.equal(output.written.length, 14);
    assert.match(output.warnings[0], /Redacted \d+ secret value/);

    const roles = await readJson(join(cwd, "blocks", "iam", "roles.json"));
    assert.equal(roles._meta.tenantId, "target-project");
    assert.equal(roles._meta.service, "iam");
    assert.equal(roles._meta.readOnly, true);
    assert.equal(roles.data.length, 150, "both pages of roles are collected");
    assert.deepEqual(server.requests.filter((r) => r.path === "/iam/v4/iam/roles").map((r) => r.body.page), [0, 1]);

    const functions = await readJson(join(cwd, "blocks", "logic", "functions.json"));
    assert.deepEqual(functions.data.map((fn) => fn.id), ["fn-1"]);
    assert.equal(server.requests.find((r) => r.path === "/logic/v4/Functions/GetAll").body.pageNumber, 0);

    const templates = await readJson(join(cwd, "blocks", "mail", "templates.json"));
    assert.deepEqual(templates.data, [{ name: "welcome" }]);
    assert.equal(server.requests.find((r) => r.path === "/os/v4/Mail/GetTemplates").query.PageNumber, "0");

    const storage = JSON.stringify(await readJson(join(cwd, "blocks", "storage", "configs.json")));
    for (const secret of ["AKIA", "s3-secret", "sftp-secret", "\"pw\"", "\"cs\""]) assert.ok(!storage.includes(secret), `leaked ${secret}`);
    const everything = (await Promise.all(output.written.map((path) => readFile(join(cwd, path), "utf8")))).join("\n");
    for (const secret of ["oidc-secret-value", "idp-secret-value", "smtp-password", "key=raw", "\"sign\""]) {
      assert.ok(!everything.includes(secret), `leaked ${secret}`);
    }
    assert.match(everything, /key=\*\*\*/, "the masked upstream is kept");
  } finally { await server.close(); }
});

test("pull --include-secrets keeps secret values and warns", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeWorkspaceConfig(cwd);
    const result = await run(["pull", "--only", "storage", "--include-secrets", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.written, ["blocks/storage/configs.json"]);
    assert.match(output.warnings[0], /WITH secrets/);
    const storage = await readJson(join(cwd, "blocks", "storage", "configs.json"));
    assert.equal(storage.data[0].secretKey, "s3-secret");
    assert.equal(storage._meta.secretsRedacted, false);
  } finally { await server.close(); }
});

test("pull reports a failing service, still writes the rest, and exits non-zero", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ failRelease: true });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeWorkspaceConfig(cwd);
    const result = await run(["pull", "--only", "release,iam", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.notEqual(result.status, 0);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.failed.map((f) => `${f.service}/${f.file}`), ["release/repos.json"]);
    assert.equal(output.written.length, 4);
  } finally { await server.close(); }
});

test("pull refuses another tenant's --project without --force, and unknown --only services", async () => {
  const { cwd, configDir } = await makeWorkspace();
  await writeWorkspaceConfig(cwd);
  const env = testEnv(configDir);

  const mismatch = await run(["pull", "--project", "other-project", "--json"], { cwd, env });
  assert.notEqual(mismatch.status, 0);
  assert.match(`${mismatch.stdout}${mismatch.stderr}`, /pull_tenant_mismatch/);

  const unknown = await run(["pull", "--only", "iam,billing", "--json"], { cwd, env });
  assert.notEqual(unknown.status, 0);
  assert.match(`${unknown.stdout}${unknown.stderr}`, /pull_unknown_service/);
});
