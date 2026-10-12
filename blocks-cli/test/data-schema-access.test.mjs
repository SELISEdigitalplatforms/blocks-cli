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

const SECURITY = "/data/v4/data-access/security/change";

async function makeWorkspace({ schemas = [], rules } = {}) {
  const base = await mkdtemp(join(tmpdir(), "blocks-data-access-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(join(cwd, "blocks", "data", "schemas"), { recursive: true });
  await mkdir(configDir, { recursive: true });
  for (const schema of schemas) {
    await writeFile(join(cwd, "blocks", "data", "schemas", `${schema.schemaName}.json`), JSON.stringify(schema));
  }
  if (rules) await writeFile(join(cwd, "blocks", "data", "rules.json"), JSON.stringify(rules));
  return { cwd, configDir };
}

async function writeProjectAuth(configDir, apiUrl) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    activeAccount: "alpha",
    accounts: {
      alpha: {
        apiUrl,
        clientId: "client-id",
        createdAt: "2026-01-01T00:00:00.000Z",
        oidcUrl: "https://iam.example.test",
        osUrl: apiUrl,
        rootTenantId: "alpha-root",
        scope: "openid profile offline_access",
        updatedAt: "2026-01-01T00:00:00.000Z",
        selectedProject: { tenantId: "target-project" }
      }
    }
  }, null, 2)}\n`);
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "alpha-target-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } } }
  }, null, 2)}\n`);
}

function run(args, { cwd, configDir }) {
  const env = { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_OPEN_BROWSER: "0" };
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

/** A stateful fake Data Gateway: created schemas show up in later lookups. */
async function startServer({ existing = {} } = {}) {
  const state = { requests: [], schemas: new Map(Object.entries(existing)), nextId: 1 };
  const html = `<!doctype html><html><body><script>window.__BLOCKS_ENV__ = { BLOCKS_AGENTS_BASE_URL: "https://agents.example.test", BLOCKS_DATA_BASE_URL: "https://data.example.test" };</script></body></html>`;

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const url = new URL(request.url, "http://127.0.0.1");
    const path = url.pathname;
    const body = bodyText ? JSON.parse(bodyText) : undefined;
    state.requests.push({ method: request.method, path, body, query: Object.fromEntries(url.searchParams) });

    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }

    let status = 200;
    let result;
    if (path === "/data/v4/schemas" && request.method === "GET") {
      const name = url.searchParams.get("SchemaName");
      const id = state.schemas.get(name);
      result = { data: { items: id ? [{ id, schemaName: name }] : [], totalCount: id ? 1 : 0 }, isSuccess: true };
    } else if ((path === "/data/v4/schemas/define" || path === "/data/v4/schemas/info") && request.method === "POST") {
      const itemId = `schema-${state.nextId++}`;
      state.schemas.set(body.schemaName, itemId);
      result = { data: { acknowledged: true, itemId }, isSuccess: true };
    } else if (path === "/data/v4/schemas/define" && request.method === "PUT") {
      result = { data: { acknowledged: true, itemId: body.itemId }, isSuccess: true };
    } else if (path === SECURITY && request.method === "POST") {
      result = { isSuccess: true, message: "CONFIGURATION_SAVED" };
    } else if (path === "/data/v4/data-access/policy/get" && request.method === "GET") {
      result = { data: [], isSuccess: true };
    } else if (path === "/data/v4/data-access/policy/create" && request.method === "POST") {
      result = { isSuccess: true, data: { itemId: "policy-1" } };
    } else if (path === "/data/v4/schema-configurations/reload" && request.method === "POST") {
      result = { data: false, isSuccess: true };
    } else {
      status = 500;
      result = { errorMessage: `Unexpected ${request.method} ${path}` };
    }

    response.setHeader("connection", "close");
    response.setHeader("content-type", "application/json");
    response.statusCode = status;
    response.end(JSON.stringify(result));
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return {
    state,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    url: `http://127.0.0.1:${port}`
  };
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];
const hits = (state, method, path) => state.requests.filter((r) => r.method === method && r.path === path);
const dataHits = (state) => state.requests.filter((r) => r.path.startsWith("/data/"));

const expense = { schemaName: "Expense", collectionName: "blx_Expenses", schemaType: 1, fields: [{ name: "Amount", type: "Float" }] };

async function setup(workspaceOptions, serverOptions) {
  const workspace = await makeWorkspace(workspaceOptions);
  const server = await startServer(serverOptions);
  await writeProjectAuth(workspace.configDir, server.url);
  return { ...workspace, server };
}

test("schema push leaves a new schema at User access by default and says so", async () => {
  const { cwd, configDir, server } = await setup({ schemas: [expense] });
  try {
    const result = await run(["data", "schema", "push", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.newSchemaAccess, { level: "user", schemas: ["Expense"] });
    assert.equal(output.grantedPublicAccess, undefined);
    assert.equal(hits(server.state, "POST", SECURITY).length, 0);
  } finally {
    await server.close();
  }
});

test("schema push --access public grants Public on all four operations", async () => {
  const { cwd, configDir, server } = await setup({ schemas: [expense] });
  try {
    const result = await run(["data", "schema", "push", "--access", "public", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.newSchemaAccess, { level: "public", schemas: ["Expense"] });
    assert.deepEqual(output.grantedPublicAccess, ["Expense"]);
    const grants = hits(server.state, "POST", SECURITY);
    assert.deepEqual(grants.map((g) => g.body.operation), [0, 1, 2, 3]);
    assert.ok(grants.every((g) => g.body.accessLevel === 2 && g.body.schemaId === "schema-1"));
  } finally {
    await server.close();
  }
});

test("schema push never changes access on an existing schema", async () => {
  const { cwd, configDir, server } = await setup({ schemas: [expense] }, { existing: { Expense: "schema-existing" } });
  try {
    const result = await run(["data", "schema", "push", "--access", "public", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.newSchemaAccess, undefined);
    assert.equal(hits(server.state, "POST", SECURITY).length, 0);
  } finally {
    await server.close();
  }
});

test("schema push rejects an unknown --access before sending anything", async () => {
  const { cwd, configDir, server } = await setup({ schemas: [expense] });
  try {
    const result = await run(["data", "schema", "push", "--access", "custom", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /--access must be 'user' or 'public'/);
    assert.equal(dataHits(server.state).length, 0);
  } finally {
    await server.close();
  }
});

test("schema info save leaves a new schema at User unless --access public", async () => {
  const { cwd, configDir, server } = await setup();
  try {
    const plain = await run(["data", "schema", "info", "save", "--schema-name", "Trip", "--collection-name", "blx_Trips", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(plain.status, 0, plain.stderr);
    assert.equal(JSON.parse(plain.stdout).newSchemaAccess, "user");
    assert.equal(hits(server.state, "POST", SECURITY).length, 0);

    const open = await run(["data", "schema", "info", "save", "--schema-name", "Note", "--collection-name", "blx_Notes", "--access", "public", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(open.status, 0, open.stderr);
    assert.equal(JSON.parse(open.stdout).grantedPublicAccess, "Note");
    assert.equal(hits(server.state, "POST", SECURITY).length, 4);
  } finally {
    await server.close();
  }
});

test("rules deploy resolves a security entry's schemaName to this project's schema id", async () => {
  const rules = { security: [{ schemaName: "Expense", operation: 0, policyType: 0, accessLevel: 1, fieldNames: [] }] };
  const { cwd, configDir, server } = await setup({ rules }, { existing: { Expense: "schema-expense" } });
  try {
    const result = await run(["data", "rules", "deploy", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const [change] = hits(server.state, "POST", SECURITY);
    assert.equal(change.body.schemaId, "schema-expense");
    assert.equal(change.body.schemaName, undefined);
    assert.equal(change.body.accessLevel, 1);
    assert.equal(change.body.projectKey, "target-project");
  } finally {
    await server.close();
  }
});

test("rules deploy still sends a bare schemaId as given", async () => {
  const rules = { security: [{ schemaId: "raw-id", operation: 1, policyType: 0, accessLevel: 3 }] };
  const { cwd, configDir, server } = await setup({ rules });
  try {
    const result = await run(["data", "rules", "deploy", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(hits(server.state, "POST", SECURITY)[0].body.schemaId, "raw-id");
  } finally {
    await server.close();
  }
});

test("rules deploy writes nothing when a security entry or policy targets an unknown schema", async () => {
  const rules = {
    security: [{ schemaName: "Expense", operation: 0, policyType: 0, accessLevel: 1 }],
    policies: [{ policyName: "own", schemaName: "Missing", operation: 0, policyType: 0, ruleGroup: {} }]
  };
  const { cwd, configDir, server } = await setup({ rules }, { existing: { Expense: "schema-expense" } });
  try {
    const result = await run(["data", "rules", "deploy", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unknown schema\(s\) 'Missing'.*nothing was deployed/);
    assert.equal(hits(server.state, "POST", SECURITY).length, 0);
    assert.equal(hits(server.state, "POST", "/data/v4/data-access/policy/create").length, 0);
  } finally {
    await server.close();
  }
});

test("rules deploy --dry-run rejects malformed security entries without calling the API", async () => {
  const rules = {
    security: [
      { schemaName: "Expense", operation: 4, policyType: 0, accessLevel: 1 },
      { operation: 0, policyType: 0, accessLevel: 9 },
      { schemaName: "Trip", operation: 2, policyType: 1, accessLevel: 1 }
    ]
  };
  const { cwd, configDir, server } = await setup({ rules });
  try {
    const result = await run(["data", "rules", "deploy", "--dry-run", ...ctx(server.url)], { cwd, configDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /security\[0\] \(Expense\): operation 4 \(ALL\) is ignored/);
    assert.match(result.stderr, /security\[1\]: set schemaName/);
    assert.match(result.stderr, /security\[1\]: accessLevel must be/);
    assert.match(result.stderr, /security\[2\] \(Trip\): column-level \(policyType 1\) entries need fieldNames/);
    assert.equal(dataHits(server.state).length, 0);
  } finally {
    await server.close();
  }
});

test("one data sync creates a schema and locks it down via a schemaName security entry", async () => {
  const rules = {
    security: [0, 1, 2, 3].map((operation) => ({ schemaName: "Expense", operation, policyType: 0, accessLevel: 3, fieldNames: [] }))
  };
  const { cwd, configDir, server } = await setup({ schemas: [expense], rules });
  try {
    const result = await run(["data", "sync", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const changes = hits(server.state, "POST", SECURITY);
    // No Public grant from the push -- only the four Custom entries from rules.json.
    assert.equal(changes.length, 4);
    assert.ok(changes.every((c) => c.body.accessLevel === 3 && c.body.schemaId === "schema-1"));
    const order = server.state.requests.map((r) => r.path);
    assert.ok(order.indexOf("/data/v4/schemas/define") < order.indexOf(SECURITY));
  } finally {
    await server.close();
  }
});

test("data sync --dry-run reports the new-schema access and validates security entries", async () => {
  const { cwd, configDir, server } = await setup({ schemas: [expense], rules: { security: [{ schemaName: "Expense", operation: 4, policyType: 0, accessLevel: 1 }] } });
  try {
    const bad = await run(["data", "sync", "--dry-run", ...ctx(server.url)], { cwd, configDir });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /operation 4 \(ALL\)/);

    await writeFile(join(cwd, "blocks", "data", "rules.json"), JSON.stringify({ security: [] }));
    const ok = await run(["data", "sync", "--dry-run", "--access", "public", ...ctx(server.url)], { cwd, configDir });
    assert.equal(ok.status, 0, ok.stderr);
    assert.equal(JSON.parse(ok.stdout).newSchemaAccess, "public");
    assert.equal(dataHits(server.state).length, 0);
  } finally {
    await server.close();
  }
});
