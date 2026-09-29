import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

const EXAMPLE1 = `name: Ping on schedule
nodes:
  - id: trigger
    name: Every hour
    type: schedule
    parameters: { triggerInterval: hours, cronExpression: "0 * * * *" }
  - id: notify
    name: Ping team
    type: httpRequest
    parameters: { url: "https://example.test/ping", method: GET }
edges:
  - from: trigger
    to: notify
`;

const EXAMPLE2 = `name: Branch
nodes:
  - id: hook
    name: Hook
    type: webhook
    parameters: { httpMethod: POST, authType: none }
  - id: check
    name: Check
    type: if
    parameters: { conditionType: all, conditions: [] }
  - id: notify
    name: Notify
    type: httpRequest
    parameters: { url: "https://example.test/yes", method: GET }
  - id: skip
    name: Skip
    type: httpRequest
    parameters: { url: "https://example.test/no", method: GET }
edges:
  - from: hook
    to: check
  - from: check
    to: notify
    fromHandle: if-true
  - from: check
    to: skip
    fromHandle: if-false
`;

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-test-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

function testAccountProfile(rootTenantId, apiUrl) {
  return {
    apiUrl,
    clientId: "client-id",
    createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test",
    osUrl: apiUrl,
    rootTenantId,
    scope: "openid profile offline_access",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };
}

async function writeProjectAuth(configDir, apiUrl) {
  await writeFile(join(configDir, "config.json"), `${JSON.stringify({
    activeAccount: "alpha",
    accounts: { alpha: { ...testAccountProfile("alpha-root", apiUrl), selectedProject: { tenantId: "target-project" } } }
  }, null, 2)}\n`);
  await writeFile(join(configDir, "tokens.json"), `${JSON.stringify({
    accounts: { alpha: { projects: { "target-project": { accessToken: "alpha-target-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() } } } }
  }, null, 2)}\n`);
}

function testEnv(configDir, extra = {}) {
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_OPEN_BROWSER: "0", ...extra };
}

function run(args, { cwd, env }) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("close", (status, signal) => {
      clearTimeout(timer);
      resolveRun({ signal, status, stderr: Buffer.concat(stderr).toString("utf8"), stdout: Buffer.concat(stdout).toString("utf8") });
    });
  });
}

function rawResponse(status, body) {
  return body === undefined ? { __httpStatus: status } : { __httpBody: body, __httpStatus: status };
}

/**
 * @param {object} opts
 * @param {number} [opts.successAfterPolls]
 * @param {boolean} [opts.failImport]
 * @param {string} [opts.failDescription]
 * @param {number} [opts.issues]
 * @param {boolean} [opts.serveLogicHtml]
 * @param {string} [opts.agentsUrl]
 * @param {string} [opts.dataUrl]
 */
async function startServer(opts = {}) {
  const {
    successAfterPolls = 2,
    failImport = false,
    failDescription = "import exploded",
    issues = 0,
    serveLogicHtml = true,
    agentsUrl = "https://agents.example.test",
    dataUrl = "https://data.example.test"
  } = opts;

  const state = {
    requests: [],
    correlationId: null,
    polls: 0,
    uploadedBody: null,
    putCount: 0
  };

  const html = `<!doctype html><html><body><script>window.__BLOCKS_ENV__ = { BLOCKS_AGENTS_BASE_URL: "${agentsUrl}", BLOCKS_DATA_BASE_URL: "${dataUrl}" };</script></body></html>`;

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const path = request.url.split("?")[0];
    state.requests.push({ method: request.method, path });

    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      if (!serveLogicHtml) {
        response.statusCode = 404;
        response.end("missing");
        return;
      }
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }

    // Presigned PUT target hosted on same server
    if (path === "/upload-bucket/workflow.json" && request.method === "PUT") {
      state.putCount += 1;
      state.uploadedBody = bodyText;
      response.statusCode = 200;
      response.end();
      return;
    }

    let result;
    if (path === "/logic/v4/Storage/GetPreSignedUrlForUpload" && request.method === "POST") {
      const addr = server.address();
      result = {
        isSuccess: true,
        uploadUrl: `http://127.0.0.1:${addr.port}/upload-bucket/workflow.json`,
        fileId: "file-abc"
      };
    } else if (path === "/logic/v4/Workflow/Import" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.correlationId = parsed.MessageCoRelationId || parsed.messageCoRelationId;
      result = { isSuccess: true };
    } else if (path === "/logic/v4/Notifier/GetNotifications" && request.method === "GET") {
      state.polls += 1;
      if (state.correlationId && state.polls >= successAfterPolls) {
        result = {
          data: [
            {
              CorrelationId: state.correlationId,
              DenormalizedPayload: {
                Message: failImport
                  ? { IsSuccess: false, description: failDescription }
                  : {
                      IsSuccess: true,
                      workflowId: "wf-abc123",
                      name: "Ping on schedule",
                      issues,
                      nodeCount: 2
                    }
              }
            }
          ]
        };
      } else {
        result = { data: [] };
      }
    } else if (path === "/os/v4/Project/Gets" && request.method === "GET") {
      result = [{
        tenantGroupId: "tg-1",
        projects: [{ tenantId: "target-project", name: "Target", tenantSlug: "target", environment: "dev" }]
      }];
    } else {
      result = rawResponse(500, { error: `Unexpected ${request.method} ${path}` });
    }

    response.setHeader("connection", "close");
    response.setHeader("content-type", "application/json");
    if (result && typeof result === "object" && "__httpStatus" in result) {
      response.statusCode = result.__httpStatus;
      response.end("__httpBody" in result ? JSON.stringify(result.__httpBody) : undefined);
      return;
    }
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

function apiHits(state) {
  return state.requests.filter((r) => r.path.startsWith("/logic/") || r.path.startsWith("/os/"));
}

test("logic push: happy path Example 1 — compile, upload, poll, record binding (H1 H2 H4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: 2 });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "push", "workflow.yaml", "--poll-interval", "1", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.workflowId, "wf-abc123");
    assert.equal(out.name, "Ping on schedule");
    assert.equal(out.issues, 0);
    assert.equal(out.nodeCount, 2);

    assert.ok(server.state.uploadedBody, "expected upload");
    const compiled = JSON.parse(server.state.uploadedBody);
    assert.equal(compiled.nodes[0].position.x, 0);
    assert.equal(compiled.nodes[1].position.x, 270);
    // single-node layers → y = -NODE_HEIGHT/2
    assert.equal(compiled.nodes[0].position.y, -75);
    assert.equal(compiled.nodes[1].position.y, -75);
    assert.equal(compiled.edges[0].sourceHandle, "source");
    assert.equal(compiled.edges[0].targetHandle, "target");

    const blocks = JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8"));
    assert.equal(blocks.logic.workflows["workflow.yaml"], "wf-abc123");
  } finally {
    await server.close();
  }
});

test("logic push: branching if handles (H2 H3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: 1 });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "branch.yaml"), EXAMPLE2);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "push", "branch.yaml", "--poll-interval", "1", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const compiled = JSON.parse(server.state.uploadedBody);
    const handles = compiled.edges.filter((e) => e.source === "check").map((e) => e.sourceHandle).sort();
    assert.deepEqual(handles, ["if-false", "if-true"]);
  } finally {
    await server.close();
  }
});

test("logic push --dry-run: webhook authorizationMode fixup (H6 H7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "hook.yaml"), `name: Hook
nodes:
  - id: hook
    name: Hook
    type: webhook
    parameters: { authType: blocksAuthorization, roles: { mode: or, values: ["admin"] } }
`);
    const env = testEnv(configDir);
    const before = server.state.requests.length;
    const result = await run(["logic", "push", "hook.yaml", "--dry-run", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dryRun, true);
    assert.equal(out.compiled.nodes[0].parameters.authorizationMode, "RolesOnly");
    assert.equal(out.compiled.nodes[0].parameters.path, "hook");
    assert.equal(apiHits(server.state).length, 0);
    assert.equal(server.state.putCount, 0);
    assert.ok(server.state.requests.length === before || apiHits(server.state).length === 0);
  } finally {
    await server.close();
  }
});

test("logic push --dry-run: dataAction + agent runtime fixups (H6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ serveLogicHtml: true });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "fixups.yaml"), `name: Fixups
nodes:
  - id: da
    name: Data
    type: dataAction
    parameters: { collection: orders, operation: get }
  - id: ag
    name: Agent
    type: agent
    parameters: { input: hi }
`);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    delete env.BLOCKS_AGENTS_BASE_URL;
    delete env.BLOCKS_DATA_BASE_URL;
    const result = await run(["logic", "push", "fixups.yaml", "--dry-run", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    const byId = Object.fromEntries(out.compiled.nodes.map((n) => [n.id, n]));
    assert.equal(byId.da.parameters.apiBaseUrl, "https://data.example.test");
    assert.equal(byId.da.parameters.projectShortKey, "target");
    assert.equal(byId.ag.parameters.ApiBaseUrl, "https://agents.example.test");
    assert.equal(server.state.putCount, 0);
  } finally {
    await server.close();
  }
});

test("logic push: runtime config unavailable (C9)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ serveLogicHtml: false });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "agent.yaml"), `name: Agent only
nodes:
  - id: ag
    name: Agent
    type: agent
    parameters: { input: hi }
`);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    delete env.BLOCKS_AGENTS_BASE_URL;
    delete env.BLOCKS_DATA_BASE_URL;
    const result = await run(["logic", "push", "agent.yaml", "--dry-run", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_runtime_config_unavailable/);
    assert.equal(server.state.putCount, 0);
  } finally {
    await server.close();
  }
});

test("logic push: unknown node type (C1)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "bad.yaml"), `name: Bad
nodes:
  - id: notify
    name: Notify
    type: sendEmail
`);
    const env = testEnv(configDir);
    const result = await run(["logic", "push", "bad.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_unknown_node_type/);
    assert.equal(server.state.putCount, 0);
    assert.ok(!apiHits(server.state).some((r) => r.path.includes("Storage") || r.path.includes("Import")));
  } finally {
    await server.close();
  }
});

test("logic push: unknown handle (C3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "bad-handle.yaml"), `name: Bad handle
nodes:
  - id: check
    name: Check
    type: if
  - id: notify
    name: Notify
    type: httpRequest
    parameters: { url: "https://example.test", method: GET }
edges:
  - from: check
    to: notify
    fromHandle: if-maybe
`);
    const env = testEnv(configDir);
    const result = await run(["logic", "push", "bad-handle.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_unknown_handle/);
    assert.equal(server.state.putCount, 0);
  } finally {
    await server.close();
  }
});

test("logic push: duplicate node id (C2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "dup.yaml"), `name: Dup
nodes:
  - id: dup
    name: A
    type: schedule
  - id: dup
    name: B
    type: httpRequest
    parameters: { url: "https://example.test", method: GET }
`);
    const env = testEnv(configDir);
    const result = await run(["logic", "push", "dup.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_duplicate_node_id/);
  } finally {
    await server.close();
  }
});

test("logic push: edge unknown node (C4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "edge.yaml"), `name: Edge
nodes:
  - id: trigger
    name: T
    type: schedule
edges:
  - from: trigger
    to: does-not-exist
`);
    const env = testEnv(configDir);
    const result = await run(["logic", "push", "edge.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_edge_unknown_node/);
  } finally {
    await server.close();
  }
});

test("logic push: empty nodes (C5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "empty.yaml"), `name: Empty
nodes: []
`);
    const env = testEnv(configDir);
    const result = await run(["logic", "push", "empty.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_bad_shape/);
    assert.equal(server.state.putCount, 0);
  } finally {
    await server.close();
  }
});

test("logic push: already pushed (C6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: 1 });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const first = await run(["logic", "push", "workflow.yaml", "--poll-interval", "1", ...ctx(server.url)], { cwd, env });
    assert.equal(first.status, 0, first.stderr);
    const second = await run(["logic", "push", "workflow.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /logic_already_pushed/);
  } finally {
    await server.close();
  }
});

test("logic push: import timeout (C7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: Infinity });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const started = Date.now();
    const result = await run(
      ["logic", "push", "workflow.yaml", "--timeout", "2", "--poll-interval", "1", ...ctx(server.url)],
      { cwd, env }
    );
    const elapsed = Date.now() - started;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_import_timeout/);
    assert.ok(elapsed < 15_000, `timeout took too long: ${elapsed}ms`);
  } finally {
    await server.close();
  }
});

test("logic push: import failed (C8)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: 1, failImport: true, failDescription: "file too large upstream" });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "push", "workflow.yaml", "--poll-interval", "1", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_import_failed/);
    assert.match(result.stderr, /file too large upstream/);
  } finally {
    await server.close();
  }
});

test("logic push: issues > 0 warning (H5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: 1, issues: 1 });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "push", "workflow.yaml", "--poll-interval", "1", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.issues, 1);
    assert.match(result.stderr, /Warning: blocks-logic reported 1 item skipped/);
  } finally {
    await server.close();
  }
});

test("logic push --no-wait: returns submitted without polling", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ successAfterPolls: Infinity });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "push", "workflow.yaml", "--no-wait", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.submitted, true);
    assert.equal(out.fileId, "file-abc");
    assert.equal(server.state.polls, 0);
  } finally {
    await server.close();
  }
});
