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

const EXAMPLE1_EDITED = `name: Ping on schedule
nodes:
  - id: trigger
    name: Every hour
    type: schedule
    parameters: { triggerInterval: hours, cronExpression: "0 * * * *" }
  - id: notify
    name: Ping team
    type: httpRequest
    parameters: { url: "https://example.test/ping", method: GET }
  - id: log
    name: Log it
    type: httpRequest
    parameters: { url: "https://example.test/log", method: POST }
edges:
  - from: trigger
    to: notify
  - from: notify
    to: log
`;

const BAD_EDGE = `name: Ping on schedule
nodes:
  - id: trigger
    name: Every hour
    type: schedule
    parameters: { triggerInterval: hours, cronExpression: "0 * * * *" }
edges:
  - from: trigger
    to: gone-node
`;

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-life-"));
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
 * Fake blocks-logic covering Phase 1 create + Phase 2 update/publish/list/get.
 * @param {object} [opts]
 * @param {boolean} [opts.failPublish]
 * @param {string} [opts.failPublishMessage]
 */
async function startServer(opts = {}) {
  const { failPublish = false, failPublishMessage = "draft has validation problems" } = opts;

  const state = {
    requests: [],
    correlationId: null,
    polls: 0,
    uploadedBody: null,
    putCount: 0,
    updateBodies: [],
    publishBodies: [],
    publishNewBodies: [],
    workflows: new Map(),
    nextVersion: 1
  };

  const html = `<!doctype html><html><body><script>window.__BLOCKS_ENV__ = { BLOCKS_AGENTS_BASE_URL: "https://agents.example.test", BLOCKS_DATA_BASE_URL: "https://data.example.test" };</script></body></html>`;

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const path = request.url.split("?")[0];
    const url = new URL(request.url, "http://127.0.0.1");
    state.requests.push({ method: request.method, path, bodyText });

    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }

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
      if (state.correlationId && state.polls >= 1) {
        const compiled = state.uploadedBody ? JSON.parse(state.uploadedBody) : { name: "Ping on schedule", nodes: [] };
        const workflowId = "wf-abc123";
        state.workflows.set(workflowId, {
          itemId: workflowId,
          name: compiled.name,
          nodes: compiled.nodes,
          edges: compiled.edges,
          settings: compiled.settings ?? {},
          isDirty: true,
          isPublished: false,
          createdDate: "2026-01-01T00:00:00.000Z",
          lastUpdatedDate: "2026-01-01T00:00:00.000Z"
        });
        result = {
          data: [
            {
              CorrelationId: state.correlationId,
              DenormalizedPayload: {
                Message: {
                  IsSuccess: true,
                  workflowId,
                  name: compiled.name,
                  issues: 0,
                  nodeCount: compiled.nodes.length
                }
              }
            }
          ]
        };
      } else {
        result = { data: [] };
      }
    } else if (path === "/logic/v4/Workflow/Update" && request.method === "PUT") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.updateBodies.push(parsed);
      const id = parsed.ItemId || parsed.itemId;
      const existing = state.workflows.get(id);
      if (!existing) {
        result = { isSuccess: false, message: `unknown ${id}` };
      } else {
        existing.name = parsed.Name || parsed.name || existing.name;
        existing.nodes = parsed.Nodes || parsed.nodes || existing.nodes;
        existing.edges = parsed.Edges || parsed.edges || existing.edges;
        existing.settings = parsed.Settings || parsed.settings || existing.settings;
        existing.isDirty = true;
        existing.lastUpdatedDate = "2026-01-02T00:00:00.000Z";
        state.workflows.set(id, existing);
        result = { isSuccess: true, itemId: id };
      }
    } else if (path === "/logic/v4/Workflow/Get" && request.method === "GET") {
      const id = url.searchParams.get("WorkflowId") || url.searchParams.get("workflowId") || url.searchParams.get("ItemId") || url.searchParams.get("itemId");
      const wf = id ? state.workflows.get(id) : undefined;
      if (!wf) {
        result = { isSuccess: false, message: "not found" };
      } else {
        result = { ...wf };
      }
    } else if (path === "/logic/v4/Workflow/GetAll" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const publishedOnly = parsed.IsPublished === true || parsed.isPublished === true;
      let items = [...state.workflows.values()];
      if (publishedOnly) items = items.filter((w) => w.isPublished);
      if (parsed.Search || parsed.search) {
        const q = String(parsed.Search || parsed.search).toLowerCase();
        items = items.filter((w) => String(w.name).toLowerCase().includes(q));
      }
      result = { data: items, totalCount: items.length, pageNumber: parsed.PageNumber ?? 0, pageSize: parsed.PageSize ?? 20 };
    } else if (path === "/logic/v4/Workflow/PublishVersion" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.publishBodies.push(parsed);
      const id = parsed.WorkflowId || parsed.workflowId;
      if (failPublish) {
        result = { isSuccess: false, message: failPublishMessage };
      } else {
        const wf = state.workflows.get(id);
        if (!wf) {
          result = { isSuccess: false, message: "not found" };
        } else {
          wf.isPublished = true;
          wf.isDirty = false;
          state.workflows.set(id, wf);
          result = { isSuccess: true };
        }
      }
    } else if (path === "/logic/v4/Workflow/PublishNewVersion" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.publishNewBodies.push(parsed);
      const id = parsed.WorkflowId || parsed.workflowId;
      if (failPublish) {
        result = { isSuccess: false, message: failPublishMessage };
      } else {
        const wf = state.workflows.get(id);
        if (!wf) {
          result = { isSuccess: false, message: "not found" };
        } else {
          wf.isPublished = true;
          wf.isDirty = false;
          const versionId = `v_${state.nextVersion++}`;
          wf.publishedVersion = versionId;
          state.workflows.set(id, wf);
          result = { isSuccess: true, versionId };
        }
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

function apiHits(state, pathPart) {
  return state.requests.filter((r) => r.path.includes(pathPart));
}

async function pushCreate(cwd, env, url, file = "workflow.yaml") {
  return run(["logic", "push", file, "--poll-interval", "1", ...ctx(url)], { cwd, env });
}

test("lifecycle: update on re-push (H1 H2) and create still Import (C6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });

    const first = await pushCreate(cwd, env, server.url);
    assert.equal(first.status, 0, first.stderr + first.stdout);
    assert.ok(apiHits(server.state, "Workflow/Import").length >= 1);
    assert.equal(server.state.putCount, 1);

    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1_EDITED);
    const beforeUpdates = server.state.updateBodies.length;
    const beforePuts = server.state.putCount;
    const beforeImports = apiHits(server.state, "Workflow/Import").length;

    const second = await run(["logic", "push", "workflow.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(second.status, 0, second.stderr + second.stdout);
    const out = JSON.parse(second.stdout);
    assert.equal(out.workflowId, "wf-abc123");
    assert.equal(out.name, "Ping on schedule");
    assert.equal(out.updated, true);
    assert.equal(server.state.updateBodies.length, beforeUpdates + 1);
    assert.equal(server.state.putCount, beforePuts);
    assert.equal(apiHits(server.state, "Workflow/Import").length, beforeImports);
    assert.equal(server.state.workflows.get("wf-abc123").nodes.length, 3);
  } finally {
    await server.close();
  }
});

test("lifecycle: publish by id (H3) and by file (H5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    const byId = await run(["logic", "publish", "wf-abc123", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(byId.status, 0, byId.stderr + byId.stdout);
    const outId = JSON.parse(byId.stdout);
    assert.equal(outId.workflowId, "wf-abc123");
    assert.equal(outId.published, true);
    assert.equal(server.state.publishBodies.length, 1);
    assert.equal(server.state.workflows.get("wf-abc123").isPublished, true);

    // Reset published flag to exercise file path → PublishVersion again
    server.state.workflows.get("wf-abc123").isPublished = false;
    const byFile = await run(["logic", "publish", "workflow.yaml", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(byFile.status, 0, byFile.stderr + byFile.stdout);
    const outFile = JSON.parse(byFile.stdout);
    assert.equal(outFile.published, true);
    assert.equal(outFile.workflowId, "wf-abc123");
  } finally {
    await server.close();
  }
});

test("lifecycle: publish --version-name (H4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    const result = await run(
      ["logic", "publish", "wf-abc123", "--version-name", "v2", "--yes", ...ctx(server.url)],
      { cwd, env }
    );
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.published, true);
    assert.ok(out.versionId, "expected versionId");
    assert.equal(server.state.publishNewBodies.length, 1);
    assert.equal(server.state.publishBodies.length, 0);
  } finally {
    await server.close();
  }
});

test("lifecycle: list + get verbatim (H6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    const listed = await run(["logic", "list", "--json", ...ctx(server.url)], { cwd, env });
    assert.equal(listed.status, 0, listed.stderr);
    const listOut = JSON.parse(listed.stdout);
    assert.equal(listOut.totalCount, 1);
    assert.equal(listOut.data[0].itemId, "wf-abc123");
    assert.equal(listOut.data[0].name, "Ping on schedule");

    const got = await run(["logic", "get", "wf-abc123", ...ctx(server.url)], { cwd, env });
    assert.equal(got.status, 0, got.stderr);
    const getOut = JSON.parse(got.stdout);
    assert.equal(getOut.itemId, "wf-abc123");
    assert.ok(Array.isArray(getOut.nodes));
    assert.equal(getOut.nodes.length, 2);
  } finally {
    await server.close();
  }
});

test("lifecycle: bad edge on update rejected client-side (C1)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    await writeFile(join(cwd, "workflow.yaml"), BAD_EDGE);
    const before = server.state.updateBodies.length;
    const result = await run(["logic", "push", "workflow.yaml", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_edge_unknown_node/);
    assert.equal(server.state.updateBodies.length, before);
  } finally {
    await server.close();
  }
});

test("lifecycle: publish unknown id (C2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "publish", "does-not-exist", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_workflow_not_found/);
  } finally {
    await server.close();
  }
});

test("lifecycle: publish unbound file (C3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "never-pushed.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    const result = await run(["logic", "publish", "never-pushed.yaml", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_not_a_pushed_file/);
  } finally {
    await server.close();
  }
});

test("lifecycle: publish upstream failure (C4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ failPublish: true, failPublishMessage: "draft has validation problems" });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    const result = await run(["logic", "publish", "wf-abc123", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /logic_publish_failed/);
    assert.match(result.stderr, /draft has validation problems/);
  } finally {
    await server.close();
  }
});

test("lifecycle: update dry-run does not call Update (C5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1_EDITED);
    const before = server.state.updateBodies.length;
    const result = await run(["logic", "push", "workflow.yaml", "--dry-run", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dryRun, true);
    assert.equal(out.updated, true);
    assert.equal(out.workflowId, "wf-abc123");
    assert.equal(out.compiled.nodes.length, 3);
    assert.equal(server.state.updateBodies.length, before);
  } finally {
    await server.close();
  }
});

test("lifecycle: list --published-only filters", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "workflow.yaml"), EXAMPLE1);
    const env = testEnv(configDir, { BLOCKS_LOGIC_WEB_URL: server.url });
    assert.equal((await pushCreate(cwd, env, server.url)).status, 0);

    const before = await run(["logic", "list", "--published-only", ...ctx(server.url)], { cwd, env });
    assert.equal(before.status, 0, before.stderr);
    assert.equal(JSON.parse(before.stdout).totalCount, 0);

    assert.equal((await run(["logic", "publish", "wf-abc123", "--yes", ...ctx(server.url)], { cwd, env })).status, 0);
    const after = await run(["logic", "list", "--published-only", ...ctx(server.url)], { cwd, env });
    assert.equal(after.status, 0, after.stderr);
    assert.equal(JSON.parse(after.stdout).totalCount, 1);
  } finally {
    await server.close();
  }
});
