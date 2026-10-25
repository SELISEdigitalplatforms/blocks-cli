import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-function-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

async function writeProjectAuth(configDir, apiUrl) {
  const profile = {
    apiUrl,
    clientId: "client-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test",
    osUrl: apiUrl,
    rootTenantId: "alpha-root",
    scope: "openid profile offline_access",
    updatedAt: "2026-01-01T00:00:00.000Z",
    selectedProject: { tenantId: "target-project" }
  };
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({ activeAccount: "alpha", accounts: { alpha: profile } }, null, 2)}\n`);
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "alpha-target-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } } }
  }, null, 2)}\n`);
}

// Strict flags: a flag the catalog doesn't know fails the command, so every test
// here also proves the catalog lists what each command actually reads.
function testEnv(configDir) {
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_OPEN_BROWSER: "0", BLOCKS_STRICT_FLAGS: "1" };
}

function run(args, { cwd, env }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (status) => {
      clearTimeout(timer);
      resolveRun({ status, stderr: Buffer.concat(stderr).toString("utf8"), stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

function storedFunction() {
  return {
    id: "fn-1",
    name: "orders",
    description: "Order lookups",
    status: "Live",
    isDirty: false,
    indexJs: "export default async function handler(input, ctx) { return { ok: true }; }\n",
    packageJson: "{\"name\":\"function\",\"type\":\"module\"}",
    lockJson: null,
    allowInstallScripts: false,
    limits: { cpuMillicores: 100, memoryMb: 128, timeoutSeconds: 30, concurrency: 10, requestsPerMinute: 120, requestsPerDay: null },
    retry: { attempts: 2, backoff: "Fixed", initialDelaySeconds: 5, maxDelaySeconds: 300 },
    trigger: {
      httpEnabled: true,
      httpMethod: "Post",
      httpMethods: ["POST"],
      authMode: "Token",
      roles: ["admin"],
      permissions: [],
      roleMatch: "Any",
      permissionMatch: "Any",
      combine: "Or",
      workflowEnabled: true,
      responseMode: "sync"
    },
    outputActions: [{ id: "oa-1", kind: "ExternalHttp", enabled: true, url: "https://hooks.example.test/x", method: "POST", headers: { Authorization: "Bearer {{secret.s1}}" }, timeoutSeconds: 30 }],
    variables: [{ key: "REGION", value: "eu" }, { key: "OLD", value: "x" }],
    activeVersionId: "v-3",
    activeVersionNumber: 3,
    lastVersionNumber: 3
  };
}

/** Fake blocks-logic FunctionsController for the management actions the CLI calls. */
async function startServer({ buildPollsBeforeSuccess = 2, deleteBlocked = false } = {}) {
  const state = { requests: [], fn: storedFunction(), buildPolls: 0 };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    const url = new URL(request.url, "http://127.0.0.1");
    const body = text ? JSON.parse(text) : undefined;
    state.requests.push({ method: request.method, path: url.pathname, body, query: Object.fromEntries(url.searchParams) });

    let status = 200;
    let result;
    switch (`${request.method} ${url.pathname}`) {
      case "POST /logic/v4/Functions/GetAll":
        result = { data: [{ id: "fn-1", name: "orders", status: "Live" }], totalCount: 1 };
        break;
      case "GET /logic/v4/Functions/Get":
        if (url.searchParams.get("functionId") !== "fn-1") {
          status = 404;
          result = { isSuccess: false, errors: { not_found: "function 'nope' was not found" } };
        } else {
          result = state.fn;
        }
        break;
      case "POST /logic/v4/Functions/Save":
        state.fn = { ...state.fn, ...body, id: "fn-1", isDirty: true };
        result = state.fn;
        break;
      case "POST /logic/v4/Functions/Deploy":
        if (body.buildId) {
          result = { id: "v-4", number: 4, imageDigest: "sha256:abc", note: body.note ?? null };
        } else {
          status = 202;
          result = { buildId: "b-1", status: "Building" };
        }
        break;
      case "GET /logic/v4/Functions/GetBuild":
        state.buildPolls += 1;
        result = { id: "b-1", status: state.buildPolls > buildPollsBeforeSuccess ? "Succeeded" : "Building" };
        break;
      case "DELETE /logic/v4/Functions/Delete":
        if (deleteBlocked && url.searchParams.get("force") !== "true") {
          status = 400;
          result = { isSuccess: false, errors: { invalid_request: "in use", deleteBlocked: "true", activeRuns: "0", workflows: "2" } };
        } else {
          result = { isSuccess: true };
        }
        break;
      case "POST /logic/v4/Functions/Test":
        status = 400;
        result = { code: "FUNCTION_FORBIDDEN_CONTENT", message: "the execution envelope contains a forbidden key at 'body.password'; credentials must never reach a sandbox" };
        break;
      default:
        status = 500;
        result = { error: `unexpected ${request.method} ${url.pathname}` };
    }
    response.statusCode = status;
    response.setHeader("connection", "close");
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(result));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return {
    state,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    url: `http://127.0.0.1:${port}`
  };
}

const hits = (state, method, path) => state.requests.filter((r) => r.method === method && r.path === path);

test("function list posts the GetAll filter with the server's spellings", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "list", "--search", "ord", "--status", "live", "--sort", "name", "--page-size", "5", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout).data.map((fn) => fn.id), ["fn-1"]);
    assert.deepEqual(hits(server.state, "POST", "/logic/v4/Functions/GetAll")[0].body, {
      searchKey: "ord", status: "Live", sortBy: "Name", pageNumber: 0, pageSize: 5
    });
  } finally { await server.close(); }
});

test("function save --dir merges source, function.json and flags over the stored function", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const dir = join(cwd, "fn");
    await mkdir(dir);
    await writeFile(join(dir, "index.js"), "export default async () => ({ v: 2 });\n");
    await writeFile(join(dir, "package.json"), "{\"name\":\"function\",\"type\":\"module\"}\n");
    await writeFile(join(dir, "function.json"), JSON.stringify({ trigger: { authMode: "Public" } }));

    const result = await run([
      "logic", "function", "save", "fn-1", "--dir", dir,
      "--http-methods", "get,post", "--var", "NEW=1", "--var", "REGION=us", "--unset-var", "OLD",
      "--yes", ...ctx(server.url)
    ], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);

    const sent = hits(server.state, "POST", "/logic/v4/Functions/Save")[0].body;
    assert.equal(sent.functionId, "fn-1");
    assert.equal(sent.indexJs, "export default async () => ({ v: 2 });\n");
    assert.equal(sent.trigger.authMode, "Public", "function.json overrides the stored trigger field");
    assert.deepEqual(sent.trigger.httpMethods, ["GET", "POST"]);
    assert.deepEqual(sent.trigger.roles, ["admin"], "untouched trigger fields are carried over");
    assert.equal(sent.trigger.responseMode, "sync");
    assert.equal(sent.limits.requestsPerMinute, 120, "the tenant's rate limit survives a source-only save");
    assert.equal("requestsPerDay" in sent.limits, false, "per-day is never sent back (the server refuses it)");
    assert.deepEqual(sent.outputActions, storedFunction().outputActions);
    assert.deepEqual(sent.variables, [{ key: "REGION", value: "us" }, { key: "NEW", value: "1" }]);
  } finally { await server.close(); }
});

test("function save --dry-run redacts and sends nothing", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "save", "fn-1", "--requests-per-minute", "default", "--dry-run", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const plan = JSON.parse(result.stdout);
    assert.equal(plan.dryRun, true);
    assert.equal(plan.request.limits.requestsPerMinute, null);
    assert.equal(hits(server.state, "POST", "/logic/v4/Functions/Save").length, 0);
  } finally { await server.close(); }
});

test("function deploy waits for a running build, then deploys exactly that build", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ buildPollsBeforeSuccess: 1 });
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "deploy", "fn-1", "--note", "v4", "--yes", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.deployed, true);
    assert.equal(out.version.number, 4);
    const deploys = hits(server.state, "POST", "/logic/v4/Functions/Deploy").map((r) => r.body);
    assert.deepEqual(deploys.map((d) => d.buildId), [undefined, "b-1"]);
    assert.equal(server.state.buildPolls, 2);
  } finally { await server.close(); }
});

test("function deploy --no-wait returns the pending build", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "deploy", "fn-1", "--no-wait", "--yes", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { deployed: false, buildId: "b-1", status: "Building" });
    assert.equal(server.state.buildPolls, 0);
  } finally { await server.close(); }
});

test("function delete surfaces FUNCTION_DELETE_BLOCKED; --force deletes", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ deleteBlocked: true });
  try {
    await writeProjectAuth(configDir, server.url);
    const blocked = await run(["logic", "function", "delete", "fn-1", "--yes", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(blocked.status, 1);
    const error = JSON.parse(blocked.stderr);
    assert.equal(error.code, "FUNCTION_DELETE_BLOCKED");
    assert.match(error.nextStep, /--force/);

    const forced = await run(["logic", "function", "delete", "fn-1", "--force", "--yes", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(forced.status, 0, forced.stderr);
    assert.deepEqual(JSON.parse(forced.stdout), { functionId: "fn-1", deleted: true, force: true });
  } finally { await server.close(); }
});

test("function get maps a 404 to FUNCTION_NOT_FOUND", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "get", "nope", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).code, "FUNCTION_NOT_FOUND");
  } finally { await server.close(); }
});

test("function test maps a refused credential to FUNCTION_FORBIDDEN_CONTENT", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "test", "fn-1", "--input", "{\"password\":\"x\"}", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 1);
    assert.equal(JSON.parse(result.stderr).code, "FUNCTION_FORBIDDEN_CONTENT");
    assert.equal(hits(server.state, "POST", "/logic/v4/Functions/Test")[0].body.inputJson, "{\"password\":\"x\"}");
  } finally { await server.close(); }
});

test("function export writes the save --dir layout and refuses to overwrite", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const dir = join(cwd, "functions", "orders");
    const first = await run(["logic", "function", "export", "fn-1", "--dir", dir, ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(first.status, 0, first.stderr);
    assert.deepEqual(JSON.parse(first.stdout).files, ["index.js", "package.json", "function.json"]);
    assert.equal(await readFile(join(dir, "index.js"), "utf8"), storedFunction().indexJs);
    const config = JSON.parse(await readFile(join(dir, "function.json"), "utf8"));
    assert.deepEqual(config.limits, { requestsPerMinute: 120 });
    assert.equal(config.trigger.responseMode, "sync");

    const again = await run(["logic", "function", "export", "fn-1", "--dir", dir, ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(again.status, 1);
    assert.equal(JSON.parse(again.stderr).code, "function_dir_not_empty");
  } finally { await server.close(); }
});

test("function url composes the public route and reports the trigger", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["logic", "function", "url", "fn-1", "--path", "/orders/42/", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.url, `${server.url}/logic/v4/fn/fn-1/orders/42`);
    assert.equal(out.xBlocksKey, "target-project");
    assert.deepEqual(out.methods, ["POST"]);
    assert.equal(out.authMode, "Token");
    assert.equal(out.responseMode, "sync");
    assert.equal(out.deployed, true);
  } finally { await server.close(); }
});
