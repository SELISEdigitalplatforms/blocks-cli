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
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-proxy-hist-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  return { base, cwd, configDir };
}

function testAccountProfile(rootTenantId, apiUrl) {
  return {
    apiUrl, clientId: "client-id", createdAt: "2026-01-01T00:00:00.000Z",
    oidcUrl: "https://iam.example.test", osUrl: apiUrl, rootTenantId,
    scope: "openid profile offline_access", updatedAt: "2026-01-01T00:00:00.000Z"
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

function rawResponse(status, body) {
  return body === undefined ? { __httpStatus: status } : { __httpBody: body, __httpStatus: status };
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function stderrJson(result) {
  const blob = `${result.stderr}\n${result.stdout}`;
  const match = blob.match(/\{[\s\S]*"code"\s*:\s*"[^"]+"[\s\S]*\}/);
  if (match) {
    const parsed = parseJson(match[0]);
    if (parsed?.code) return parsed;
  }
  return parseJson(result.stderr.trim()) ?? parseJson(result.stdout.trim());
}

function slugify(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proxy";
}

function detailOf(record) {
  return {
    itemId: record.itemId, name: record.name, slug: record.slug, upstream: record.upstream,
    methods: record.methods, enabled: record.enabled, headers: record.headers, query: record.query,
    bodyMerge: record.bodyMerge, routes: record.routes, responseMode: record.responseMode,
    responseInclude: record.responseInclude, access: record.access, currentVersion: record.currentVersion,
    createdDate: record.createdDate, lastUpdatedDate: record.lastUpdatedDate
  };
}

async function startServer() {
  const state = {
    requests: [],
    proxies: new Map(),
    versions: new Map(), // proxyId -> version[]
    executions: new Map(), // proxyId -> execution[]
    deletedProxies: new Set(),
    nextId: 1,
    nextVersion: 1,
    nextExec: 1,
    testCalls: []
  };

  const html = `<!doctype html><html><body></body></html>`;

  function ensureVersions(proxyId) {
    if (!state.versions.has(proxyId)) state.versions.set(proxyId, []);
    return state.versions.get(proxyId);
  }
  function ensureExecs(proxyId) {
    if (!state.executions.has(proxyId)) state.executions.set(proxyId, []);
    return state.executions.get(proxyId);
  }

  function addVersion(proxyId, kind, changes, label) {
    const list = ensureVersions(proxyId);
    const itemId = `ver_${state.nextVersion++}`;
    const row = {
      itemId,
      versionNumber: list.length + 1,
      versionLabel: label || kind,
      kind,
      changeSummary: changes.map((c) => c.field).join(","),
      changes,
      who: "user-1",
      whoName: "Tester",
      whenUtc: new Date(Date.UTC(2026, 0, list.length + 1)).toISOString()
    };
    list.unshift(row); // newest first
    // renumber newest-first display numbers? keep versionNumber as creation order
    return row;
  }

  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const path = request.url.split("?")[0];
    const url = new URL(request.url, "http://127.0.0.1");
    state.requests.push({ method: request.method, path, bodyText, query: Object.fromEntries(url.searchParams) });

    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }

    let result;

    if (path === "/os/v4/Project/Gets" && request.method === "GET") {
      result = [{ tenantGroupId: "tg-1", projects: [{ tenantId: "target-project", name: "Target", tenantSlug: "target", environment: "dev" }] }];
    } else if (path === "/logic/v4/Proxies/test" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.testCalls.push(parsed);
      const method = (parsed.method || parsed.Method || "").toUpperCase();
      const draft = parsed.draft || parsed.Draft;
      const proxyId = parsed.proxyId || parsed.ProxyId;
      let methods = [];
      if (proxyId) {
        const p = state.proxies.get(proxyId);
        if (!p) {
          result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${proxyId}'.` };
        } else {
          methods = p.methods;
        }
      } else if (draft) {
        methods = draft.methods || draft.Methods || [];
      } else {
        result = { isSuccess: false, code: "PROXY_VALIDATION", message: "Exactly one of ProxyId / Draft required.", errors: { proxyId: "required" } };
      }
      if (!result) {
        if (!methods.map(String).map((m) => m.toUpperCase()).includes(method)) {
          result = { isSuccess: false, code: "PROXY_VALIDATION", message: `Method '${method}' is not allowed.`, errors: { method: "not in effective methods" } };
        } else {
          const upstream = proxyId ? state.proxies.get(proxyId).upstream : (draft.upstream || draft.Upstream);
          const suffix = parsed.pathSuffix || parsed.PathSuffix || "";
          result = {
            ok: true, status: 200, outcome: "Success", latencyMs: 42,
            upstreamUrl: `${upstream.replace(/\/$/, "")}/${suffix}`.replace(/([^:]\/)\/+/g, "$1"),
            upstreamHost: new URL(upstream).host,
            injectedHeaderKeys: [], injectedQueryKeys: [],
            responseContentType: "application/json", responseBody: "{}",
            responseFilterApplied: false, responseFilterNote: null, responseBodyBytes: 2,
            errorMessage: null
          };
        }
      }
    } else if (path === "/logic/v4/Proxies" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const name = parsed.name || parsed.Name;
      const slug = slugify(name || "proxy");
      if ([...state.proxies.values()].some((p) => p.slug === slug)) {
        result = { isSuccess: false, code: "PROXY_SLUG_CONFLICT", message: `slug '${slug}' exists` };
      } else {
        const itemId = `prx_${state.nextId++}`;
        const record = {
          itemId, name, slug,
          upstream: parsed.upstream || parsed.Upstream,
          methods: parsed.methods || parsed.Methods || [],
          enabled: true, headers: parsed.headers || [], query: parsed.query || [],
          bodyMerge: parsed.bodyMerge || {}, routes: parsed.routes || [],
          responseMode: "All", responseInclude: [], access: parsed.access || { kind: "BlocksToken" },
          currentVersion: 1, createdDate: "2026-01-01T00:00:00.000Z", lastUpdatedDate: "2026-01-01T00:00:00.000Z"
        };
        state.proxies.set(itemId, record);
        addVersion(itemId, "Create", []);
        result = rawResponse(201, { isSuccess: true, itemId });
      }
    } else if (path === "/logic/v4/Proxies" && request.method === "GET") {
      const items = [...state.proxies.values()].map((p) => ({
        itemId: p.itemId, name: p.name, slug: p.slug, upstream: p.upstream, methods: p.methods, enabled: p.enabled
      }));
      result = { data: items, totalCount: items.length };
    } else if (/^\/logic\/v4\/Proxies\/[^/]+\/versions\/[^/]+\/revert$/.test(path) && request.method === "POST") {
      const parts = path.split("/");
      const proxyId = decodeURIComponent(parts[4]);
      const versionId = decodeURIComponent(parts[6]);
      if (state.deletedProxies.has(proxyId)) {
        result = { isSuccess: false, code: "PROXY_DELETED", message: `Proxy '${proxyId}' was deleted.` };
      } else if (!state.proxies.has(proxyId) && !state.versions.has(proxyId)) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${proxyId}'.` };
      } else {
        const versions = ensureVersions(proxyId);
        const target = versions.find((v) => v.itemId === versionId);
        if (!target) {
          result = { isSuccess: false, code: "PROXY_VERSION_NOT_FOUND", message: `No version '${versionId}'.` };
        } else if (target.kind === "Create" || target.kind === "Delete" || target.changes.length === 0) {
          result = { isSuccess: false, code: "PROXY_VERSION_NOT_REVERTABLE", message: `Version '${versionId}' is not revertable.` };
        } else {
          // Conflict if a later (newer = lower index) version also changed the same field
          const newer = versions.filter((v) => v.versionNumber > target.versionNumber);
          const conflictField = target.changes.find((c) => newer.some((n) => n.changes.some((nc) => nc.field === c.field)));
          if (conflictField) {
            result = { isSuccess: false, code: "PROXY_REVERT_CONFLICT", message: `Field '${conflictField.field}' was changed again later.` };
          } else {
            const proxy = state.proxies.get(proxyId);
            for (const change of target.changes) {
              if (change.field === "upstream") proxy.upstream = change.before;
              if (change.field === "name") proxy.name = change.before;
            }
            proxy.currentVersion += 1;
            state.proxies.set(proxyId, proxy);
            addVersion(proxyId, "Revert", target.changes.map((c) => ({ field: c.field, label: c.label, before: c.after, after: c.before })));
            result = { isSuccess: true, itemId: proxyId };
          }
        }
      }
    } else if (/^\/logic\/v4\/Proxies\/[^/]+\/versions$/.test(path) && request.method === "GET") {
      const proxyId = decodeURIComponent(path.split("/")[4]);
      if (!state.proxies.has(proxyId) && !state.versions.has(proxyId) && !state.deletedProxies.has(proxyId)) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${proxyId}'.` };
      } else {
        const all = ensureVersions(proxyId);
        const page = Number(url.searchParams.get("Page") ?? url.searchParams.get("page") ?? 0);
        const pageSize = Number(url.searchParams.get("PageSize") ?? url.searchParams.get("pageSize") ?? 50);
        result = { data: all.slice(page * pageSize, page * pageSize + pageSize), totalCount: all.length };
      }
    } else if (/^\/logic\/v4\/Proxies\/[^/]+\/executions\/[^/]+$/.test(path) && request.method === "GET") {
      const parts = path.split("/");
      const proxyId = decodeURIComponent(parts[4]);
      const executionId = decodeURIComponent(parts[6]);
      const list = ensureExecs(proxyId);
      const row = list.find((e) => e.itemId === executionId);
      result = row ? { data: row } : { data: null };
    } else if (/^\/logic\/v4\/Proxies\/[^/]+\/executions$/.test(path) && request.method === "GET") {
      const proxyId = decodeURIComponent(path.split("/")[4]);
      if (!state.proxies.has(proxyId) && !state.executions.has(proxyId)) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${proxyId}'.` };
      } else {
        const statusClass = (url.searchParams.get("StatusClass") || url.searchParams.get("statusClass") || "all").toLowerCase();
        if (!["all", "2xx", "4xx", "5xx"].includes(statusClass)) {
          result = { isSuccess: false, code: "PROXY_VALIDATION", message: `Invalid statusClass '${statusClass}'.`, errors: { statusClass: "invalid" } };
        } else {
          let rows = [...ensureExecs(proxyId)].sort((a, b) => a.startedAtUtc.localeCompare(b.startedAtUtc));
          if (statusClass !== "all") {
            const prefix = statusClass[0];
            rows = rows.filter((r) => String(r.statusCode).startsWith(prefix));
          }
          const afterId = url.searchParams.get("AfterId") || url.searchParams.get("afterId");
          const asOf = url.searchParams.get("AsOfUtc") || url.searchParams.get("asOfUtc") || url.searchParams.get("AsOf") || url.searchParams.get("asOf") || new Date().toISOString();
          const totalCount = rows.length;
          if (afterId) {
            const idx = rows.findIndex((r) => r.itemId === afterId);
            rows = idx >= 0 ? rows.slice(idx + 1) : rows;
          } else {
            const page = Number(url.searchParams.get("Page") ?? url.searchParams.get("page") ?? 0);
            const pageSize = Number(url.searchParams.get("PageSize") ?? url.searchParams.get("pageSize") ?? 25);
            // pin by asOf: only rows <= asOf
            rows = rows.filter((r) => r.startedAtUtc <= asOf);
            rows = rows.slice(page * pageSize, page * pageSize + pageSize);
          }
          result = { data: rows, totalCount, asOfUtc: asOf };
        }
      }
    } else if (/^\/logic\/v4\/Proxies\/[^/]+\/overview$/.test(path) && request.method === "GET") {
      const proxyId = decodeURIComponent(path.split("/")[4]);
      const execs = ensureExecs(proxyId);
      if (!state.proxies.has(proxyId) && execs.length === 0) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${proxyId}'.` };
      } else {
        const proxy = state.proxies.get(proxyId);
        const latencies = execs.map((e) => e.latencyMs);
        const errors = execs.filter((e) => e.statusCode >= 400).length;
        result = {
          calls24h: execs.length,
          avgLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
          errorRatePct: execs.length ? Math.round((errors / execs.length) * 1000) / 10 : 0,
          errorRateIsHigh: execs.length ? errors / execs.length > 0.05 : false,
          credentialRefs: [],
          methods: proxy?.methods ?? [],
          lastCallAtUtc: execs.length ? execs[execs.length - 1].startedAtUtc : null
        };
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "GET") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      if (id.includes("/")) {
        result = rawResponse(500, { error: `Unhandled GET ${path}` });
      } else {
        const record = state.proxies.get(id);
        result = record ? { data: detailOf(record) } : { data: null };
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "PUT") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const existing = state.proxies.get(id);
      if (!existing) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` };
      } else {
        const changes = [];
        const newUpstream = parsed.upstream ?? parsed.Upstream;
        if (newUpstream && newUpstream !== existing.upstream) {
          changes.push({ field: "upstream", label: "Upstream", before: existing.upstream, after: newUpstream });
          existing.upstream = newUpstream;
        }
        const newName = parsed.name ?? parsed.Name;
        if (newName && newName !== existing.name) {
          changes.push({ field: "name", label: "Name", before: existing.name, after: newName });
          existing.name = newName;
        }
        if (parsed.methods || parsed.Methods) existing.methods = parsed.methods || parsed.Methods;
        if (parsed.routes || parsed.Routes) existing.routes = parsed.routes || parsed.Routes;
        if (parsed.headers || parsed.Headers) existing.headers = parsed.headers || parsed.Headers;
        if (parsed.access || parsed.Access) existing.access = parsed.access || parsed.Access;
        existing.currentVersion += 1;
        existing.lastUpdatedDate = "2026-01-02T00:00:00.000Z";
        state.proxies.set(id, existing);
        addVersion(id, "ConfigUpdate", changes);
        result = { isSuccess: true, itemId: id };
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "DELETE") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      if (!state.proxies.has(id)) {
        result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` };
      } else {
        state.proxies.delete(id);
        state.deletedProxies.add(id);
        addVersion(id, "Delete", []);
        result = { isSuccess: true, itemId: id };
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "PATCH") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      const existing = state.proxies.get(id);
      if (!existing) result = { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` };
      else {
        existing.enabled = parsed.Enabled ?? parsed.enabled;
        result = { isSuccess: true, itemId: id, enabled: existing.enabled };
      }
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

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  return {
    state,
    addVersion,
    seedExecution(proxyId, overrides = {}) {
      const list = ensureExecs(proxyId);
      const itemId = overrides.itemId || `exec_${state.nextExec++}`;
      const row = {
        itemId,
        startedAtUtc: overrides.startedAtUtc || new Date(Date.UTC(2026, 0, 1, 0, list.length)).toISOString(),
        requestMethod: overrides.requestMethod || "GET",
        requestPath: overrides.requestPath || "/v1",
        statusCode: overrides.statusCode ?? 200,
        latencyMs: overrides.latencyMs ?? 50,
        outcome: overrides.outcome || "Success",
        upstreamHost: overrides.upstreamHost || "api.example.test",
        callerKind: "BlocksToken",
        callerUserName: "tester",
        callerImpersonated: false,
        routePath: overrides.routePath || null,
        responseBody: "{}",
        responseBodyTruncatedForDisplay: false
      };
      list.push(row);
      return row;
    },
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    url: `http://127.0.0.1:${port}`
  };
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

async function createProxy(cwd, env, url, name = "Stripe", upstream = "https://api.stripe.com") {
  const r = await run([
    "logic", "proxy", "create", "--name", name, "--upstream", upstream, "--methods", "GET,POST", "--yes", ...ctx(url)
  ], { cwd, env });
  assert.equal(r.status, 0, r.stderr);
  return parseJson(r.stdout);
}

test("history: versions newest-first after create+update (H1)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const updated = await run([
      "logic", "proxy", "update", created.itemId, "--upstream", "https://api.stripe.com/v2", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(updated.status, 0, updated.stderr);

    const versions = await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env });
    assert.equal(versions.status, 0, versions.stderr);
    const body = parseJson(versions.stdout);
    assert.equal(body.totalCount, 2);
    assert.equal(body.data[0].kind, "ConfigUpdate");
    assert.equal(body.data[0].versionNumber, 2);
    assert.equal(body.data[1].kind, "Create");
    assert.ok(body.data[0].changes.some((c) => c.field === "upstream"));
  } finally { await server.close(); }
});

test("history: revert restores upstream and appends Revert row (H2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    await run(["logic", "proxy", "update", created.itemId, "--upstream", "https://api.stripe.com/v2", "--yes", ...ctx(server.url)], { cwd, env });
    const versionsBefore = parseJson((await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    const createRow = versionsBefore.data.find((v) => v.kind === "Create");
    // Revert to Create is not revertable — revert to the ConfigUpdate's "before" by targeting create? 
    // Spec Example 2: revert to v1 item id. Our Create has empty changes → NOT_REVERTABLE.
    // Make an intermediate update so we can revert a ConfigUpdate that isn't conflicted.
    // Actually Example 2 reverts to v1 (Create). Real API may allow reverting Create differently.
    // For H2: revert a ConfigUpdate back. Seed: create, update to v2, then revert the ConfigUpdate
    // would undo the update... but ConfigUpdate's changes have before/after; reverting it restores before.
    const updateRow = versionsBefore.data.find((v) => v.kind === "ConfigUpdate");
    const reverted = await run([
      "logic", "proxy", "revert", created.itemId, updateRow.itemId, "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(reverted.status, 0, reverted.stderr);
    assert.deepEqual(parseJson(reverted.stdout), { itemId: created.itemId, revertedTo: updateRow.itemId });

    const got = parseJson((await run(["logic", "proxy", "get", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    assert.equal(got.data.upstream, "https://api.stripe.com");

    const versionsAfter = parseJson((await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    assert.equal(versionsAfter.totalCount, 3);
    assert.equal(versionsAfter.data[0].kind, "Revert");
    void createRow;
  } finally { await server.close(); }
});

test("history: test saved proxy does not write executions (H3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const tested = await run([
      "logic", "proxy", "test", created.itemId, "--method", "GET", "--path-suffix", "v1/charges/ch_123", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(tested.status, 0, tested.stderr);
    const body = parseJson(tested.stdout);
    assert.equal(body.ok, true);
    assert.equal(body.status, 200);
    assert.equal(body.outcome, "Success");
    assert.ok(body.upstreamUrl.includes("charges/ch_123"));
    assert.equal(server.state.testCalls.length, 1);
    assert.equal((server.state.executions.get(created.itemId) || []).length, 0);
  } finally { await server.close(); }
});

test("history: test --draft-file with no saved proxy (H4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const file = join(cwd, "draft.json");
    await writeFile(file, JSON.stringify({ name: "Draft", upstream: "https://vendor.example.test", methods: ["POST"] }));
    const tested = await run([
      "logic", "proxy", "test", "--draft-file", file, "--method", "POST", "--body", "{}", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(tested.status, 0, tested.stderr);
    const body = parseJson(tested.stdout);
    assert.equal(body.ok, true);
    assert.equal(server.state.proxies.size, 0);
    assert.equal([...server.state.executions.values()].flat().length, 0);
  } finally { await server.close(); }
});

test("history: executions paging with asOfUtc (H5) and after-id (H6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const e1 = server.seedExecution(created.itemId, { startedAtUtc: "2026-01-01T00:00:00.000Z" });
    const e2 = server.seedExecution(created.itemId, { startedAtUtc: "2026-01-01T00:01:00.000Z" });
    const e3 = server.seedExecution(created.itemId, { startedAtUtc: "2026-01-01T00:02:00.000Z" });

    const page0 = parseJson((await run([
      "logic", "proxy", "executions", created.itemId, "--page-size", "1", "--page", "0", ...ctx(server.url)
    ], { cwd, env })).stdout);
    assert.equal(page0.data.length, 1);
    assert.equal(page0.data[0].itemId, e1.itemId);
    assert.ok(page0.asOfUtc);

    const page1 = parseJson((await run([
      "logic", "proxy", "executions", created.itemId, "--page-size", "1", "--page", "1", "--as-of", page0.asOfUtc, ...ctx(server.url)
    ], { cwd, env })).stdout);
    assert.equal(page1.data.length, 1);
    assert.equal(page1.data[0].itemId, e2.itemId);

    const tail = parseJson((await run([
      "logic", "proxy", "executions", created.itemId, "--after-id", e1.itemId, "--page", "99", ...ctx(server.url)
    ], { cwd, env })).stdout);
    assert.equal(tail.data.length, 2);
    assert.deepEqual(tail.data.map((r) => r.itemId), [e2.itemId, e3.itemId]);
  } finally { await server.close(); }
});

test("history: overview aggregates (H7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    server.seedExecution(created.itemId, { latencyMs: 100, statusCode: 200 });
    server.seedExecution(created.itemId, { latencyMs: 200, statusCode: 500 });
    const overview = await run(["logic", "proxy", "overview", created.itemId, ...ctx(server.url)], { cwd, env });
    assert.equal(overview.status, 0, overview.stderr);
    const body = parseJson(overview.stdout);
    assert.equal(body.calls24h, 2);
    assert.equal(body.avgLatencyMs, 150);
    assert.equal(body.errorRatePct, 50);
  } finally { await server.close(); }
});

test("history: PROXY_NOT_FOUND for unknown id (C1)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    for (const args of [
      ["versions", "never-existed"],
      ["executions", "never-existed"],
      ["overview", "never-existed"]
    ]) {
      const r = await run(["logic", "proxy", ...args, ...ctx(server.url)], { cwd, env });
      assert.equal(r.status, 1, args.join(" "));
      assert.equal(stderrJson(r).code, "PROXY_NOT_FOUND");
    }
    const rev = await run(["logic", "proxy", "revert", "never-existed", "ver_x", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(rev.status, 1);
    assert.equal(stderrJson(rev).code, "PROXY_NOT_FOUND");
  } finally { await server.close(); }
});

test("history: PROXY_REVERT_CONFLICT (C2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    await run(["logic", "proxy", "update", created.itemId, "--upstream", "https://api.stripe.com/v2", "--yes", ...ctx(server.url)], { cwd, env });
    await run(["logic", "proxy", "update", created.itemId, "--upstream", "https://api.stripe.com/v3", "--yes", ...ctx(server.url)], { cwd, env });
    const versions = parseJson((await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    // oldest ConfigUpdate (v2) — versionNumber 2
    const v2 = versions.data.find((v) => v.versionNumber === 2);
    const r = await run(["logic", "proxy", "revert", created.itemId, v2.itemId, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_REVERT_CONFLICT");
  } finally { await server.close(); }
});

test("history: PROXY_VERSION_NOT_REVERTABLE on Create (C3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const versions = parseJson((await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    const createRow = versions.data.find((v) => v.kind === "Create");
    const r = await run(["logic", "proxy", "revert", created.itemId, createRow.itemId, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_VERSION_NOT_REVERTABLE");
  } finally { await server.close(); }
});

test("history: PROXY_DELETED on revert after delete (C4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    await run(["logic", "proxy", "update", created.itemId, "--upstream", "https://api.stripe.com/v2", "--yes", ...ctx(server.url)], { cwd, env });
    const versions = parseJson((await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env })).stdout);
    const updateRow = versions.data.find((v) => v.kind === "ConfigUpdate");
    await run(["logic", "proxy", "delete", created.itemId, "--yes", ...ctx(server.url)], { cwd, env });
    // versions still works
    const still = await run(["logic", "proxy", "versions", created.itemId, ...ctx(server.url)], { cwd, env });
    assert.equal(still.status, 0, still.stderr);
    const r = await run(["logic", "proxy", "revert", created.itemId, updateRow.itemId, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_DELETED");
  } finally { await server.close(); }
});

test("history: test both id and draft-file refused client-side (C5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const file = join(cwd, "d.json");
    await writeFile(file, JSON.stringify({ name: "X", upstream: "https://example.test", methods: ["GET"] }));
    const before = server.state.requests.length;
    const r = await run([
      "logic", "proxy", "test", "prx_1", "--draft-file", file, "--method", "GET", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_VALIDATION");
    assert.equal(server.state.requests.length, before);
  } finally { await server.close(); }
});

test("history: test bad method → PROXY_VALIDATION (C6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const r = await run(["logic", "proxy", "test", created.itemId, "--method", "TRACE", ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_VALIDATION");
  } finally { await server.close(); }
});

test("history: execution mismatch → data null (C7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const a = await createProxy(cwd, env, server.url, "A", "https://a.example.test");
    const b = await createProxy(cwd, env, server.url, "B", "https://b.example.test");
    const exec = server.seedExecution(a.itemId);
    const r = await run(["logic", "proxy", "execution", b.itemId, exec.itemId, ...ctx(server.url)], { cwd, env });
    assert.equal(r.status, 0, r.stderr);
    assert.deepEqual(parseJson(r.stdout), { data: null });
  } finally { await server.close(); }
});

test("history: bad status-class → PROXY_VALIDATION (C8)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await createProxy(cwd, env, server.url);
    const r = await run([
      "logic", "proxy", "executions", created.itemId, "--status-class", "bogus", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(r.status, 1);
    assert.equal(stderrJson(r).code, "PROXY_VALIDATION");
  } finally { await server.close(); }
});
