import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-data-indexes-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

function profile(apiUrl) {
  return {
    apiUrl, clientId: "client-id", createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test", osUrl: apiUrl, rootTenantId: "alpha-root",
    scope: "openid", updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

async function writeProjectAuth(configDir, apiUrl) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    activeAccount: "alpha",
    accounts: { alpha: { ...profile(apiUrl), selectedProject: { tenantId: "target-project" } } }
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

function parseJson(text) { try { return JSON.parse(text); } catch { return null; } }
function stderrJson(result) {
  const blob = `${result.stderr}\n${result.stdout}`;
  const match = blob.match(/\{[\s\S]*"code"\s*:\s*"[^"]+"[\s\S]*\}/);
  if (match) { const p = parseJson(match[0]); if (p?.code) return p; }
  return parseJson(result.stderr.trim()) ?? parseJson(result.stdout.trim());
}

async function startServer() {
  const state = { requests: [] };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const url = new URL(request.url, "http://localhost");
    state.requests.push({ method: request.method, path: url.pathname, query: Object.fromEntries(url.searchParams), bodyText });

    let status = 200;
    let result;
    if (url.pathname === "/os/v4/Project/Gets") {
      result = [{ tenantGroupId: "tg-1", projects: [{ tenantId: "target-project", name: "Target", tenantSlug: "target", environment: "dev" }] }];
    } else if (url.pathname === "/data/v4/schemas/indexes" && request.method === "GET") {
      result = { isSuccess: true, data: {
        indexes: [{ itemId: "idx-1", name: "status_1", fields: [{ fieldName: "status", direction: "ASC" }], isUnique: false }],
        systemIndexes: [{ itemId: "system:location_2dsphere", name: "location_2dsphere", fields: [{ fieldName: "location", direction: "ASC" }], isUnique: false }]
      } };
    } else if (url.pathname === "/data/v4/schemas/indexes" && request.method === "POST") {
      const parsed = JSON.parse(bodyText);
      if (parsed.fields.some((field) => field.fieldName === "location")) {
        status = 400;
        result = { isSuccess: false, errors: { message: "FIELD_NOT_INDEXABLE: location" } };
      } else {
        result = { isSuccess: true, data: { acknowledged: true, itemId: "idx-2" } };
      }
    } else if (url.pathname === "/data/v4/schemas/indexes" && request.method === "DELETE") {
      result = { isSuccess: true, data: { acknowledged: true, itemId: url.searchParams.get("itemId") } };
    } else if (url.pathname === "/data/v4/schema-configurations/reload") {
      result = { isSuccess: true };
    } else {
      status = 404;
      result = { message: `unexpected ${request.method} ${url.pathname}` };
    }
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(result));
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  return { server, state, url: `http://127.0.0.1:${server.address().port}` };
}

async function setup() {
  const workspace = await makeWorkspace();
  const api = await startServer();
  await writeProjectAuth(workspace.configDir, api.url);
  return { ...workspace, ...api, env: testEnv(workspace.configDir) };
}

test("data schema indexes list reports user and system (GeoJson) indexes", async () => {
  const { cwd, env, server, state, url } = await setup();
  try {
    const result = await run(["data", "schema", "indexes", "list", "schema-1", "--api-url", url, "--json"], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const body = JSON.parse(result.stdout);
    assert.equal(body.data.systemIndexes[0].itemId, "system:location_2dsphere");
    const get = state.requests.find((r) => r.path === "/data/v4/schemas/indexes");
    assert.deepEqual(get.query, { schemaDefinitionItemId: "schema-1" });

    const human = await run(["data", "schema", "indexes", "list", "schema-1", "--api-url", url], { cwd, env });
    assert.match(human.stdout, /automatic 2dsphere indexes of GeoJson fields/);
  } finally {
    server.close();
  }
});

test("data schema indexes create sends the CreateSchemaIndexRequest shape", async () => {
  const { cwd, env, server, state, url } = await setup();
  try {
    const dry = await run([
      "data", "schema", "indexes", "create", "--schema-id", "schema-1", "--fields", "status,createdDate:desc",
      "--unique", "--dry-run", "--api-url", url, "--json"
    ], { cwd, env });
    assert.equal(dry.status, 0, dry.stderr);
    assert.deepEqual(JSON.parse(dry.stdout).request, {
      fields: [{ fieldName: "status", direction: "ASC" }, { fieldName: "createdDate", direction: "DESC" }],
      isUnique: true,
      schemaDefinitionItemId: "schema-1"
    });
    assert.equal(state.requests.length, 0, "dry-run must not call the API");

    const created = await run([
      "data", "schema", "indexes", "create", "--schema-id", "schema-1", "--fields", "status", "--yes", "--api-url", url, "--json"
    ], { cwd, env });
    assert.equal(created.status, 0, created.stderr);
    const post = state.requests.find((r) => r.method === "POST" && r.path === "/data/v4/schemas/indexes");
    assert.deepEqual(JSON.parse(post.bodyText), { fields: [{ fieldName: "status", direction: "ASC" }], schemaDefinitionItemId: "schema-1" });
    assert.ok(state.requests.some((r) => r.path === "/data/v4/schema-configurations/reload"), "create must reload the gateway");

    const bad = await run(["data", "schema", "indexes", "create", "--schema-id", "schema-1", "--fields", "status:sideways", "--dry-run", "--json"], { cwd, env });
    assert.notEqual(bad.status, 0);
    assert.equal(stderrJson(bad)?.code, "invalid_index_field");
  } finally {
    server.close();
  }
});

test("data schema indexes create explains why a GeoJson field is not indexable", async () => {
  const { cwd, env, server, url } = await setup();
  try {
    const result = await run([
      "data", "schema", "indexes", "create", "--schema-id", "schema-1", "--fields", "location", "--yes", "--api-url", url, "--json"
    ], { cwd, env });
    assert.notEqual(result.status, 0);
    const error = stderrJson(result);
    assert.equal(error?.code, "field_not_indexable");
    assert.match(JSON.stringify(error), /2dsphere/);
  } finally {
    server.close();
  }
});

test("data schema indexes delete refuses system GeoJson indexes and deletes user ones", async () => {
  const { cwd, env, server, state, url } = await setup();
  try {
    const refused = await run(["data", "schema", "indexes", "delete", "system:location_2dsphere", "--yes", "--api-url", url, "--json"], { cwd, env });
    assert.notEqual(refused.status, 0);
    assert.equal(stderrJson(refused)?.code, "system_index_not_deletable");
    assert.equal(state.requests.filter((r) => r.method === "DELETE").length, 0);

    const deleted = await run(["data", "schema", "indexes", "delete", "idx-1", "--yes", "--api-url", url, "--json"], { cwd, env });
    assert.equal(deleted.status, 0, deleted.stderr);
    const del = state.requests.find((r) => r.method === "DELETE");
    assert.deepEqual(del.query, { itemId: "idx-1" });
  } finally {
    server.close();
  }
});

test("schema field types are case-sensitive: miscased GeoJson/String are refused locally", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const env = testEnv(configDir);
  await mkdir(join(cwd, "blocks", "data", "schemas"), { recursive: true });
  await writeFile(join(cwd, "blocks", "data", "schemas", "Place.json"), JSON.stringify({
    schemaName: "Place",
    fields: [{ name: "location", type: "GeoJSON" }, { name: "title", type: "string" }, { name: "owner", type: "Customer" }]
  }));

  const validate = await run(["data", "validate", "--json"], { cwd, env });
  const { errors } = JSON.parse(validate.stdout);
  assert.ok(errors.some((e) => e.includes("'location'") && e.includes("use 'GeoJson'")), errors.join("\n"));
  assert.ok(errors.some((e) => e.includes("'title'") && e.includes("use 'String'")), errors.join("\n"));
  assert.ok(!errors.some((e) => e.includes("'owner'")), "a reference to another schema is not a scalar");

  const fields = await run([
    "data", "schema", "fields", "--schema-id", "schema-1", "--body", JSON.stringify({ fields: [{ name: "location", type: "geojson" }] }), "--dry-run", "--json"
  ], { cwd, env });
  assert.notEqual(fields.status, 0);
  assert.match(fields.stderr + fields.stdout, /use 'GeoJson'/);
});
