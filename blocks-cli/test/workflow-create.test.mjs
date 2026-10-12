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

// The exact minimal example from the blocks-workflow skill (references/nodes.md) that
// 500ed on Workflow/Create in the field.
const webhookWorkflow = {
  name: "Webhook Sanity Test",
  settings: {},
  nodes: [
    {
      id: "n1", name: "Hook", category: "trigger", type: "webhook", version: "v1",
      position: { x: 0, y: 0 },
      parameters: { httpMethod: "POST", authType: "none", path: "n1" },
      settings: {}, pinData: null
    },
    {
      id: "n2", name: "Call", category: "action", type: "httpRequest", version: "v1",
      position: { x: 200, y: 0 },
      parameters: { method: "GET", url: "https://example.test" },
      settings: {}, pinData: null
    }
  ],
  edges: [{ id: "e1", source: "n1", target: "n2" }]
};

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-workflow-create-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
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

/**
 * A fake blocks-logic that reproduces the server bug: Create 500s whenever a node
 * carries a non-empty `parameters` object (Newtonsoft -> BsonDocument), while Update
 * stores nodes fine. `failUpdate` makes Update return a failure envelope.
 */
async function startServer({ failUpdate = false } = {}) {
  const state = { requests: [], workflows: new Map(), nextId: 1 };
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
    if (path === "/logic/v4/Workflow/GetAll" && request.method === "POST") {
      result = { data: [...state.workflows.values()], totalCount: state.workflows.size };
    } else if (path === "/logic/v4/Workflow/Create" && request.method === "POST") {
      const bad = (body.nodes ?? []).findIndex((node) => node.parameters && Object.keys(node.parameters).length);
      if (bad >= 0) {
        status = 500;
        result = { error: `Cannot deserialize the current JSON object into type 'MongoDB.Bson.BsonDocument'. Path '[${bad}].parameters'` };
      } else {
        const itemId = `wf-${state.nextId++}`;
        state.workflows.set(itemId, { itemId, ...body });
        status = 201;
        result = { isSuccess: true, itemId, errors: null };
      }
    } else if (path === "/logic/v4/Workflow/Update" && request.method === "PUT") {
      const current = state.workflows.get(body.itemId);
      if (failUpdate || !current) {
        result = { isSuccess: false, itemId: null, errors: { Message: failUpdate ? "Update rejected" : "Workflow not found" } };
      } else {
        state.workflows.set(body.itemId, { ...current, ...body });
        result = { isSuccess: true, itemId: body.itemId, errors: null };
      }
    } else if (path === "/logic/v4/Workflow/Delete" && request.method === "DELETE") {
      state.workflows.delete(url.searchParams.get("Id"));
      result = { isSuccess: true };
    } else if (path === "/logic/v4/Workflow/PublishNewVersion" && request.method === "POST") {
      result = { isSuccess: true, itemId: "version-1" };
    } else {
      status = 500;
      result = { error: `Unexpected ${request.method} ${path}` };
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

async function setup(options) {
  const workspace = await makeWorkspace();
  const server = await startServer(options);
  await writeProjectAuth(workspace.configDir, server.url);
  const file = join(workspace.cwd, "webhook.json");
  await writeFile(file, JSON.stringify(webhookWorkflow));
  return { ...workspace, server, file };
}

test("workflow import creates a workflow with node parameters via empty Create + Update", async () => {
  const { cwd, configDir, server, file } = await setup();
  try {
    const result = await run(["logic", "workflow", "import", "--file", file, "--publish", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.action, "create");
    assert.equal(output.workflowId, "wf-1");
    assert.equal(output.published, true);

    const [create] = hits(server.state, "POST", "/logic/v4/Workflow/Create");
    assert.deepEqual(create.body.nodes, []);
    assert.deepEqual(create.body.edges, []);
    assert.equal(create.body.name, "Webhook Sanity Test");
    assert.deepEqual(create.body.settings, {});

    const [update] = hits(server.state, "PUT", "/logic/v4/Workflow/Update");
    assert.equal(update.body.itemId, "wf-1");
    assert.equal(update.body.nodes.length, 2);
    assert.deepEqual(update.body.nodes[0].parameters, { httpMethod: "POST", authType: "none", path: update.body.nodes[0].id });
    assert.equal(update.body.edges.length, 1);
    assert.equal(update.body.edges[0].source, update.body.nodes[0].id);

    const [publish] = hits(server.state, "POST", "/logic/v4/Workflow/PublishNewVersion");
    assert.equal(publish.body.workflowId, "wf-1");
    assert.equal(server.state.workflows.get("wf-1").nodes.length, 2);
  } finally {
    await server.close();
  }
});

test("workflow import still updates an existing workflow of the same name in one PUT", async () => {
  const { cwd, configDir, server, file } = await setup();
  try {
    server.state.workflows.set("wf-existing", { itemId: "wf-existing", name: "Webhook Sanity Test", nodes: [], edges: [] });
    const result = await run(["logic", "workflow", "import", "--file", file, "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.action, "update");
    assert.equal(output.workflowId, "wf-existing");
    assert.equal(hits(server.state, "POST", "/logic/v4/Workflow/Create").length, 0);
    assert.equal(hits(server.state, "PUT", "/logic/v4/Workflow/Update").length, 1);
  } finally {
    await server.close();
  }
});

test("workflow import deletes the empty workflow when filling in the graph fails", async () => {
  const { cwd, configDir, server, file } = await setup({ failUpdate: true });
  try {
    const result = await run(["logic", "workflow", "import", "--file", file, "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Update rejected/);
    assert.match(result.stderr, /empty workflow 'wf-1' was deleted/);
    const [deleted] = hits(server.state, "DELETE", "/logic/v4/Workflow/Delete");
    assert.equal(deleted.query.Id, "wf-1");
    assert.equal(server.state.workflows.size, 0);
  } finally {
    await server.close();
  }
});

test("workflow save --file creates via empty Create + Update and returns the created id", async () => {
  const { cwd, configDir, server, file } = await setup();
  try {
    const result = await run(["logic", "workflow", "save", "--file", file, "--description", "smoke", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).itemId, "wf-1");

    const [create] = hits(server.state, "POST", "/logic/v4/Workflow/Create");
    assert.deepEqual(create.body.nodes, []);
    assert.equal(create.body.description, "smoke");
    const [update] = hits(server.state, "PUT", "/logic/v4/Workflow/Update");
    // save sends the graph as given -- no id remap.
    assert.deepEqual(update.body.nodes, webhookWorkflow.nodes);
    assert.deepEqual(update.body.edges, webhookWorkflow.edges);
    assert.equal(update.body.description, undefined);
  } finally {
    await server.close();
  }
});

test("workflow save without nodes sends a single Create", async () => {
  const { cwd, configDir, server } = await setup();
  try {
    const result = await run(["logic", "workflow", "save", "--body", "{\"name\":\"Empty\",\"settings\":{}}", "--yes", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(hits(server.state, "POST", "/logic/v4/Workflow/Create").length, 1);
    assert.equal(hits(server.state, "PUT", "/logic/v4/Workflow/Update").length, 0);
  } finally {
    await server.close();
  }
});

test("workflow save --dry-run shows the Create and the follow-up Update", async () => {
  const { cwd, configDir, server, file } = await setup();
  try {
    const result = await run(["logic", "workflow", "save", "--file", file, "--dry-run", ...ctx(server.url)], { cwd, configDir });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.endpoint, "/logic/v4/Workflow/Create");
    assert.deepEqual(output.request.nodes, []);
    assert.equal(output.then.endpoint, "/logic/v4/Workflow/Update");
    assert.equal(output.then.method, "PUT");
    assert.equal(output.then.request.itemId, "<created id>");
    assert.equal(output.then.request.nodes.length, 2);
    assert.equal(server.state.requests.filter((r) => r.path.startsWith("/logic/")).length, 0);
  } finally {
    await server.close();
  }
});
