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
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-sched-"));
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
  const state = { requests: [], schedules: new Map(), nextId: 1, updateBodies: [], deleteIds: [] };

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const path = request.url.split("?")[0];
    state.requests.push({ method: request.method, path, bodyText });

    let result;
    if (path === "/os/v4/Project/Gets" && request.method === "GET") {
      result = [{ tenantGroupId: "tg-1", projects: [{ tenantId: "target-project", name: "Target", tenantSlug: "target", environment: "dev" }] }];
    } else if (path === "/logic/v4/Scheduler/CreateSchedule" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const itemId = `sch_${state.nextId++}`;
      const record = {
        itemId,
        name: parsed.name,
        description: parsed.description || "",
        payload: parsed.payload || "",
        cronExpression: parsed.cronExpression,
        startDate: parsed.startDate || null,
        endDate: parsed.endDate || null,
        isActive: parsed.isActive !== false,
        kind: "Webhook",
        triggerType: "Cron",
        webhook: {
          url: parsed.webhook?.url,
          method: parsed.webhook?.method || "POST",
          headers: parsed.webhook?.headers || {},
          signingSecret: parsed.webhook?.signingSecret || undefined
        }
      };
      state.schedules.set(itemId, record);
      result = { isSuccess: true, itemId };
    } else if (path === "/logic/v4/Scheduler/UpdateSchedule" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.updateBodies.push(parsed);
      const id = parsed.itemId || parsed.ItemId;
      const existing = state.schedules.get(id);
      if (!existing) {
        result = { isSuccess: false, message: `unknown ${id}` };
      } else {
        Object.assign(existing, {
          name: parsed.name ?? existing.name,
          description: parsed.description ?? existing.description,
          payload: parsed.payload ?? existing.payload,
          cronExpression: parsed.cronExpression ?? existing.cronExpression,
          startDate: parsed.startDate ?? existing.startDate,
          endDate: parsed.endDate ?? existing.endDate,
          isActive: parsed.isActive ?? existing.isActive,
          webhook: parsed.webhook ? {
            url: parsed.webhook.url ?? existing.webhook.url,
            method: parsed.webhook.method ?? existing.webhook.method,
            headers: parsed.webhook.headers ?? existing.webhook.headers,
            signingSecret: parsed.webhook.signingSecret ?? existing.webhook.signingSecret
          } : existing.webhook
        });
        state.schedules.set(id, existing);
        result = { isSuccess: true, itemId: id };
      }
    } else if (path === "/logic/v4/Scheduler/DeleteSchedule" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const id = parsed.itemId || parsed.ItemId;
      state.deleteIds.push(id);
      if (!state.schedules.has(id)) result = { isSuccess: false, message: "not found" };
      else { state.schedules.delete(id); result = { isSuccess: true }; }
    } else if (path === "/logic/v4/Scheduler/GetSchedules" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      let items = [...state.schedules.values()].map((s) => {
        const copy = structuredClone(s);
        // API may or may not return signingSecret — we still strip in CLI.
        return copy;
      });
      if (parsed.Search || parsed.search) {
        const q = String(parsed.Search || parsed.search).toLowerCase();
        items = items.filter((s) => s.name.toLowerCase().includes(q));
      }
      const page = Number(parsed.PageNumber ?? parsed.pageNumber ?? parsed.Page ?? parsed.page ?? 0);
      const pageSize = Number(parsed.PageSize ?? parsed.pageSize ?? 10);
      result = { data: items.slice(page * pageSize, page * pageSize + pageSize), totalCount: items.length };
    } else {
      result = { __httpStatus: 500, __httpBody: { error: `${request.method} ${path}` } };
    }

    response.setHeader("connection", "close");
    response.setHeader("content-type", "application/json");
    if (result && typeof result === "object" && "__httpStatus" in result) {
      response.statusCode = result.__httpStatus;
      response.end(JSON.stringify(result.__httpBody));
      return;
    }
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

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

test("scheduler: create happy (H1) and secret never echoed (C7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const r = await run([
      "logic", "scheduler", "create",
      "--name", "Nightly sync", "--cron", "0 2 * * *", "--url", "https://example.test/sync",
      "--signing-secret", "super-secret", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    const body = parseJson(r.stdout);
    assert.deepEqual(body, { itemId: "sch_1", name: "Nightly sync", cronExpression: "0 2 * * *", isActive: true });
    assert.ok(!JSON.stringify(body).includes("super-secret"));
    assert.equal(server.state.schedules.get("sch_1").webhook.signingSecret, "super-secret");
  } finally { await server.close(); }
});

test("scheduler: update cron only preserves other fields (H2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = parseJson((await run([
      "logic", "scheduler", "create", "--name", "Nightly sync", "--cron", "0 2 * * *",
      "--url", "https://example.test/sync", "--yes", ...ctx(server.url)
    ], { cwd, env })).stdout);
    const updated = await run([
      "logic", "scheduler", "update", created.itemId, "--cron", "0 3 * * *", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(updated.status, 0, updated.stderr);
    const body = parseJson(updated.stdout);
    assert.equal(body.cronExpression, "0 3 * * *");
    assert.equal(body.name, "Nightly sync");
    const stored = server.state.schedules.get(created.itemId);
    assert.equal(stored.cronExpression, "0 3 * * *");
    assert.equal(stored.webhook.url, "https://example.test/sync");
    assert.equal(server.state.updateBodies.length, 1);
  } finally { await server.close(); }
});

test("scheduler: repeatable --header (H3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const r = await run([
      "logic", "scheduler", "create",
      "--name", "H", "--cron", "0 * * * *", "--url", "https://example.test/h",
      "--header", "X-A=1", "--header", "X-B=2", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    const id = parseJson(r.stdout).itemId;
    assert.deepEqual(server.state.schedules.get(id).webhook.headers, { "X-A": "1", "X-B": "2" });
  } finally { await server.close(); }
});

test("scheduler: delete then list (H4) and list redacts secret (H5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = parseJson((await run([
      "logic", "scheduler", "create", "--name", "T", "--cron", "0 * * * *",
      "--url", "https://example.test/t", "--signing-secret", "keep-secret", "--yes", ...ctx(server.url)
    ], { cwd, env })).stdout);

    const listed = await run(["logic", "scheduler", "list", ...ctx(server.url)], { cwd, env });
    assert.equal(listed.status, 0, listed.stderr);
    assert.ok(!listed.stdout.includes("keep-secret"));
    assert.equal(parseJson(listed.stdout).totalCount, 1);

    const deleted = await run(["logic", "scheduler", "delete", created.itemId, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(deleted.status, 0, deleted.stderr);
    assert.deepEqual(parseJson(deleted.stdout), { itemId: created.itemId, deleted: true });

    const after = parseJson((await run(["logic", "scheduler", "list", ...ctx(server.url)], { cwd, env })).stdout);
    assert.equal(after.totalCount, 0);
  } finally { await server.close(); }
});

test("scheduler: create --file (H6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const file = join(cwd, "sched.json");
    await writeFile(file, JSON.stringify({
      name: "FromFile", cronExpression: "15 * * * *",
      webhook: { url: "https://example.test/file", method: "PUT", headers: { A: "1" } },
      payload: "{\"ok\":true}"
    }));
    const r = await run(["logic", "scheduler", "create", "--file", file, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    const id = parseJson(r.stdout).itemId;
    const stored = server.state.schedules.get(id);
    assert.equal(stored.name, "FromFile");
    assert.equal(stored.cronExpression, "15 * * * *");
    assert.equal(stored.webhook.method, "PUT");
    assert.equal(stored.payload, "{\"ok\":true}");
  } finally { await server.close(); }
});

test("scheduler: validation before request (C1 C2 C3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const before = server.state.requests.length;

    const missingName = await run([
      "logic", "scheduler", "create", "--cron", "0 * * * *", "--url", "https://example.test", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(missingName.status, 1);
    assert.equal(stderrJson(missingName).code, "scheduler_name_required");

    const badCron = await run([
      "logic", "scheduler", "create", "--name", "x", "--cron", "not a cron", "--url", "https://example.test", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(badCron.status, 1);
    assert.equal(stderrJson(badCron).code, "scheduler_invalid_cron");

    const badUrl = await run([
      "logic", "scheduler", "create", "--name", "x", "--cron", "0 * * * *", "--url", "not-a-url", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(badUrl.status, 1);
    assert.equal(stderrJson(badUrl).code, "scheduler_invalid_webhook_url");

    assert.equal(server.state.requests.filter((r) => r.path.includes("/Scheduler/")).length, 0);
    void before;
  } finally { await server.close(); }
});

test("scheduler: update unknown → not_found no Update (C4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const r = await run([
      "logic", "scheduler", "update", "does-not-exist", "--cron", "0 * * * *", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "scheduler_not_found");
    assert.equal(server.state.updateBodies.length, 0);
  } finally { await server.close(); }
});

test("scheduler: delete unknown / without --yes (C5 C6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const missing = await run(["logic", "scheduler", "delete", "nope", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(missing.status, 1);
    assert.equal(stderrJson(missing).code, "scheduler_not_found");

    const created = parseJson((await run([
      "logic", "scheduler", "create", "--name", "Keep", "--cron", "0 * * * *",
      "--url", "https://example.test/k", "--yes", ...ctx(server.url)
    ], { cwd, env })).stdout);
    const refused = await run(["logic", "scheduler", "delete", created.itemId, ...ctx(server.url)], { cwd, env });
    assert.equal(refused.status, 1);
    assert.match(refused.stderr + refused.stdout, /Confirmation required|--yes/i);
    assert.ok(server.state.schedules.has(created.itemId));
  } finally { await server.close(); }
});

test("scheduler: deactivate via --inactive (Example 4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = parseJson((await run([
      "logic", "scheduler", "create", "--name", "N", "--cron", "0 * * * *",
      "--url", "https://example.test/n", "--yes", ...ctx(server.url)
    ], { cwd, env })).stdout);
    const r = await run([
      "logic", "scheduler", "update", created.itemId, "--inactive", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(parseJson(r.stdout).isActive, false);
    assert.equal(server.state.schedules.get(created.itemId).isActive, false);
  } finally { await server.close(); }
});

test("scheduler: list empty (Example 6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const r = await run(["logic", "scheduler", "list", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(parseJson(r.stdout), { data: [], totalCount: 0 });
  } finally { await server.close(); }
});
