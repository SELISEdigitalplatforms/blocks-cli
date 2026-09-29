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
  const base = await mkdtemp(join(tmpdir(), "blocks-logic-proxy-"));
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

function slugify(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proxy";
}

function detailOf(record) {
  return {
    itemId: record.itemId,
    name: record.name,
    slug: record.slug,
    upstream: record.upstream,
    methods: record.methods,
    enabled: record.enabled,
    headers: record.headers,
    query: record.query,
    bodyMerge: record.bodyMerge,
    routes: record.routes,
    responseMode: record.responseMode,
    responseInclude: record.responseInclude,
    access: record.access,
    currentVersion: record.currentVersion,
    createdDate: record.createdDate,
    lastUpdatedDate: record.lastUpdatedDate
  };
}

/**
 * Fake blocks-logic Proxies controller covering List/Create/Get/Update/Toggle/Delete.
 */
async function startServer() {
  const state = {
    requests: [],
    proxies: new Map(),
    nextId: 1,
    putBodies: [],
    patchBodies: [],
    deleteIds: [],
    createBodies: []
  };

  const html = `<!doctype html><html><body><script>window.__BLOCKS_ENV__ = { BLOCKS_AGENTS_BASE_URL: "https://agents.example.test", BLOCKS_DATA_BASE_URL: "https://data.example.test" };</script></body></html>`;

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
      result = [{
        tenantGroupId: "tg-1",
        projects: [{ tenantId: "target-project", name: "Target", tenantSlug: "target", environment: "dev" }]
      }];
    } else if (path === "/logic/v4/Proxies" && request.method === "GET") {
      let items = [...state.proxies.values()];
      const search = url.searchParams.get("Search") || url.searchParams.get("search");
      if (search) {
        const q = search.toLowerCase();
        items = items.filter((p) => p.name.toLowerCase().includes(q) || p.slug.includes(q));
      }
      const isActiveRaw = url.searchParams.get("IsActive") ?? url.searchParams.get("isActive");
      if (isActiveRaw === "true") items = items.filter((p) => p.enabled);
      if (isActiveRaw === "false") items = items.filter((p) => !p.enabled);
      const page = Number(url.searchParams.get("Page") ?? url.searchParams.get("page") ?? url.searchParams.get("PageNumber") ?? 0);
      const pageSize = Number(url.searchParams.get("PageSize") ?? url.searchParams.get("pageSize") ?? 20);
      const sliced = items.slice(page * pageSize, page * pageSize + pageSize);
      result = {
        data: sliced.map((p) => ({
          itemId: p.itemId,
          name: p.name,
          slug: p.slug,
          upstream: p.upstream,
          upstreamMasked: p.upstream,
          methods: p.methods,
          enabled: p.enabled,
          injectedCredential: false,
          headerCount: (p.headers ?? []).length,
          queryCount: (p.query ?? []).length,
          calls24h: 0,
          createdDate: p.createdDate,
          lastUpdatedDate: p.lastUpdatedDate
        })),
        totalCount: items.length
      };
    } else if (path === "/logic/v4/Proxies" && request.method === "POST") {
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.createBodies.push(parsed);
      const name = parsed.name || parsed.Name;
      const slug = slugify(name || "proxy");
      if ([...state.proxies.values()].some((p) => p.slug === slug)) {
        // 200 failure envelope (Blocks style) so acceptFailureEnvelope preserves code.
        result = { isSuccess: false, code: "PROXY_SLUG_CONFLICT", message: `A proxy with slug '${slug}' already exists.` };
      } else if (!name || !(parsed.upstream || parsed.Upstream)) {
        result = {
          isSuccess: false,
          code: "PROXY_VALIDATION",
          message: "Validation failed.",
          errors: { name: name ? undefined : "required", upstream: (parsed.upstream || parsed.Upstream) ? undefined : "required" }
        };
      } else {
        const itemId = `prx_${state.nextId++}`;
        const record = {
          itemId,
          name,
          slug,
          upstream: parsed.upstream || parsed.Upstream,
          methods: parsed.methods || parsed.Methods || [],
          enabled: parsed.enabled !== undefined ? Boolean(parsed.enabled) : parsed.Enabled !== undefined ? Boolean(parsed.Enabled) : true,
          headers: parsed.headers || parsed.Headers || [],
          query: parsed.query || parsed.Query || [],
          bodyMerge: parsed.bodyMerge || parsed.BodyMerge || {},
          routes: parsed.routes || parsed.Routes || [],
          responseMode: parsed.responseMode || parsed.ResponseMode || "All",
          responseInclude: parsed.responseInclude || parsed.ResponseInclude || [],
          access: parsed.access || parsed.Access || { kind: "BlocksToken" },
          currentVersion: 1,
          createdDate: "2026-01-01T00:00:00.000Z",
          lastUpdatedDate: "2026-01-01T00:00:00.000Z"
        };
        state.proxies.set(itemId, record);
        result = rawResponse(201, { isSuccess: true, itemId });
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "GET") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      const record = state.proxies.get(id);
      result = record ? { data: detailOf(record) } : { data: null };
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "PUT") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.putBodies.push({ id, body: parsed });
      const existing = state.proxies.get(id);
      if (!existing) {
        result = rawResponse(404, { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` });
      } else {
        // Full replace except Enabled + Slug (server contract).
        existing.name = parsed.name ?? parsed.Name ?? existing.name;
        existing.upstream = parsed.upstream ?? parsed.Upstream ?? existing.upstream;
        existing.methods = parsed.methods ?? parsed.Methods ?? [];
        existing.headers = parsed.headers ?? parsed.Headers ?? [];
        existing.query = parsed.query ?? parsed.Query ?? [];
        existing.bodyMerge = parsed.bodyMerge ?? parsed.BodyMerge ?? {};
        existing.routes = parsed.routes ?? parsed.Routes ?? [];
        existing.responseMode = parsed.responseMode ?? parsed.ResponseMode ?? "All";
        existing.responseInclude = parsed.responseInclude ?? parsed.ResponseInclude ?? [];
        existing.access = parsed.access ?? parsed.Access ?? { kind: "BlocksToken" };
        existing.currentVersion += 1;
        existing.lastUpdatedDate = "2026-01-02T00:00:00.000Z";
        state.proxies.set(id, existing);
        result = { isSuccess: true, itemId: id };
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "PATCH") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      const parsed = bodyText ? JSON.parse(bodyText) : {};
      state.patchBodies.push({ id, body: parsed });
      const existing = state.proxies.get(id);
      if (!existing) {
        result = rawResponse(404, { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` });
      } else {
        const enabled = parsed.Enabled ?? parsed.enabled;
        if (typeof enabled !== "boolean") {
          result = rawResponse(400, { isSuccess: false, code: "PROXY_VALIDATION", message: "Enabled required.", errors: { Enabled: "required" } });
        } else {
          existing.enabled = enabled;
          existing.lastUpdatedDate = "2026-01-03T00:00:00.000Z";
          state.proxies.set(id, existing);
          result = { isSuccess: true, itemId: id, enabled };
        }
      }
    } else if (path.startsWith("/logic/v4/Proxies/") && request.method === "DELETE") {
      const id = decodeURIComponent(path.slice("/logic/v4/Proxies/".length));
      state.deleteIds.push(id);
      if (!state.proxies.has(id)) {
        result = rawResponse(404, { isSuccess: false, code: "PROXY_NOT_FOUND", message: `No proxy '${id}'.` });
      } else {
        state.proxies.delete(id);
        result = { isSuccess: true, itemId: id };
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

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return {
    state,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    url: `http://127.0.0.1:${port}`
  };
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stderrJson(result) {
  const blob = `${result.stderr}\n${result.stdout}`;
  const match = blob.match(/\{[\s\S]*"code"\s*:\s*"[^"]+"[\s\S]*\}/);
  if (match) {
    const parsed = parseJson(match[0]);
    if (parsed && parsed.code) return parsed;
  }
  return parseJson(result.stderr.trim()) ?? parseJson(result.stdout.trim());
}

function dumpFail(label, result) {
  if (result.status === 0) return;
  // keep quiet unless parse fails later
}

function apiHits(state, method, pathExact) {
  return state.requests.filter((r) => r.method === method && r.path === pathExact);
}

test("proxy: simple create then get detail (H1 / Example 1)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await run([
      "logic", "proxy", "create",
      "--name", "Stripe",
      "--upstream", "https://api.stripe.com",
      "--methods", "GET,POST",
      "--yes",
      ...ctx(server.url)
    ], { cwd, env });
    assert.equal(created.status, 0, created.stderr);
    const body = parseJson(created.stdout);
    assert.ok(body);
    assert.equal(body.name, "Stripe");
    assert.equal(body.slug, "stripe");
    assert.equal(body.upstream, "https://api.stripe.com");
    assert.deepEqual(body.methods, ["GET", "POST"]);
    assert.equal(body.enabled, true);
    assert.ok(body.itemId);
    assert.equal(server.state.proxies.size, 1);
    assert.equal(apiHits(server.state, "POST", "/logic/v4/Proxies").length, 1);
    assert.ok(apiHits(server.state, "GET", `/logic/v4/Proxies/${body.itemId}`).length >= 1);
  } finally {
    await server.close();
  }
});

test("proxy: create --file with routes/access (H2 / Example 2)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const file = join(cwd, "proxy.json");
    await writeFile(file, JSON.stringify({
      name: "Orders",
      upstream: "https://vendor.example.test",
      methods: ["GET", "POST"],
      routes: [{ match: "orders/{id}", upstream: "v1/charges/{id}" }],
      access: { kind: "Role", roles: ["ops"] },
      headers: [{ name: "X-Api-Key", value: "secret" }],
      enabled: true
    }));
    const created = await run([
      "logic", "proxy", "create", "--file", file, "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(created.status, 0, created.stderr);
    const body = parseJson(created.stdout);
    assert.equal(body.name, "Orders");
    assert.deepEqual(body.routes, [{ match: "orders/{id}", upstream: "v1/charges/{id}" }]);
    assert.deepEqual(body.access, { kind: "Role", roles: ["ops"] });
    assert.equal(body.headers.length, 1);
    const stored = server.state.proxies.get(body.itemId);
    assert.deepEqual(stored.routes, body.routes);
    assert.deepEqual(stored.access, body.access);
  } finally {
    await server.close();
  }
});

test("proxy: Mode A update preserves routes (H3 / Example 3)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    // Seed via create --file with routes
    const file = join(cwd, "seed.json");
    await writeFile(file, JSON.stringify({
      name: "Stripe",
      upstream: "https://api.stripe.com",
      methods: ["GET", "POST"],
      routes: [{ match: "charges/{id}", upstream: "v1/charges/{id}" }],
      access: { kind: "BlocksToken" }
    }));
    const seeded = await run(["logic", "proxy", "create", "--file", file, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(seeded.status, 0, seeded.stderr);
    const id = parseJson(seeded.stdout).itemId;

    const updated = await run([
      "logic", "proxy", "update", id,
      "--upstream", "https://api.stripe.com/v2",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(updated.status, 0, updated.stderr);
    const body = parseJson(updated.stdout);
    assert.equal(body.upstream, "https://api.stripe.com/v2");
    assert.deepEqual(body.routes, [{ match: "charges/{id}", upstream: "v1/charges/{id}" }]);
    assert.equal(server.state.putBodies.length, 1);
    const put = server.state.putBodies[0].body;
    assert.equal(put.upstream, "https://api.stripe.com/v2");
    assert.deepEqual(put.routes, [{ match: "charges/{id}", upstream: "v1/charges/{id}" }]);
  } finally {
    await server.close();
  }
});

test("proxy: disable then enable (H4 / Example 4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await run([
      "logic", "proxy", "create",
      "--name", "ToggleMe", "--upstream", "https://example.test", "--methods", "GET",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    const id = parseJson(created.stdout).itemId;

    const disabled = await run(["logic", "proxy", "disable", id, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(disabled.status, 0, disabled.stderr);
    assert.deepEqual(parseJson(disabled.stdout), { itemId: id, enabled: false });
    assert.equal(server.state.proxies.get(id).enabled, false);

    const enabled = await run(["logic", "proxy", "enable", id, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(enabled.status, 0, enabled.stderr);
    assert.deepEqual(parseJson(enabled.stdout), { itemId: id, enabled: true });
    assert.equal(server.state.proxies.get(id).enabled, true);
    assert.equal(server.state.patchBodies.length, 2);
  } finally {
    await server.close();
  }
});

test("proxy: get unknown id returns data null (H5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const got = await run(["logic", "proxy", "get", "does-not-exist", ...ctx(server.url)], { cwd, env });
    assert.equal(got.status, 0, got.stderr);
    assert.deepEqual(parseJson(got.stdout), { data: null });
  } finally {
    await server.close();
  }
});

test("proxy: list empty (Example 6) and delete then get null (H6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);

    const listed = await run(["logic", "proxy", "list", ...ctx(server.url)], { cwd, env });
    assert.equal(listed.status, 0, listed.stderr);
    assert.deepEqual(parseJson(listed.stdout), { data: [], totalCount: 0 });

    const created = await run([
      "logic", "proxy", "create",
      "--name", "Temp", "--upstream", "https://example.test", "--methods", "DELETE",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    const id = parseJson(created.stdout).itemId;

    const deleted = await run(["logic", "proxy", "delete", id, "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(deleted.status, 0, deleted.stderr);
    assert.deepEqual(parseJson(deleted.stdout), { itemId: id, deleted: true });

    const got = await run(["logic", "proxy", "get", id, ...ctx(server.url)], { cwd, env });
    assert.equal(got.status, 0, got.stderr);
    assert.deepEqual(parseJson(got.stdout), { data: null });
  } finally {
    await server.close();
  }
});

test("proxy: validation errors before any request (C1 C2 C3 C4)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const before = server.state.requests.length;

    const missingName = await run([
      "logic", "proxy", "create",
      "--upstream", "https://api.stripe.com", "--methods", "GET", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(missingName.status, 1);
    assert.equal(stderrJson(missingName).code, "proxy_name_required");

    const badUpstream = await run([
      "logic", "proxy", "create",
      "--name", "Stripe", "--upstream", "not-a-url", "--methods", "GET", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(badUpstream.status, 1);
    assert.equal(stderrJson(badUpstream).code, "proxy_invalid_upstream");

    const badMethods = await run([
      "logic", "proxy", "create",
      "--name", "Stripe", "--upstream", "https://api.stripe.com", "--methods", "FETCH", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(badMethods.status, 1);
    assert.equal(stderrJson(badMethods).code, "proxy_invalid_methods");

    const file = join(cwd, "x.json");
    await writeFile(file, JSON.stringify({ name: "X", upstream: "https://example.test", methods: ["GET"] }));
    const both = await run([
      "logic", "proxy", "create", "--file", file, "--name", "Stripe", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(both.status, 1);
    assert.equal(stderrJson(both).code, "proxy_mode_conflict");

    assert.equal(server.state.requests.length, before, "no Proxies API calls for validation failures");
  } finally {
    await server.close();
  }
});

test("proxy: PROXY_SLUG_CONFLICT surfaced (C5)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const first = await run([
      "logic", "proxy", "create",
      "--name", "Stripe", "--upstream", "https://api.stripe.com", "--methods", "GET",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(first.status, 0, first.stderr);

    const second = await run([
      "logic", "proxy", "create",
      "--name", "Stripe", "--upstream", "https://api.stripe.com", "--methods", "POST",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(second.status, 1);
    const err = stderrJson(second);
    assert.equal(err.code, "PROXY_SLUG_CONFLICT");
    assert.match(err.message, /slug/i);
  } finally {
    await server.close();
  }
});

test("proxy: update unknown id → proxy_not_found, no PUT (C6)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const updated = await run([
      "logic", "proxy", "update", "does-not-exist",
      "--upstream", "https://example.test", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(updated.status, 1);
    assert.equal(stderrJson(updated).code, "proxy_not_found");
    assert.equal(server.state.putBodies.length, 0);
  } finally {
    await server.close();
  }
});

test("proxy: disable unknown id → proxy_not_found (C7)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const disabled = await run([
      "logic", "proxy", "disable", "does-not-exist", "--yes", ...ctx(server.url)
    ], { cwd, env });
    assert.equal(disabled.status, 1);
    assert.equal(stderrJson(disabled).code, "proxy_not_found");
  } finally {
    await server.close();
  }
});

test("proxy: delete without --yes refuses (C8)", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir);
    const created = await run([
      "logic", "proxy", "create",
      "--name", "Keep", "--upstream", "https://example.test", "--methods", "GET",
      "--yes", ...ctx(server.url)
    ], { cwd, env });
    const id = parseJson(created.stdout).itemId;
    const before = server.state.proxies.size;

    const deleted = await run([
      "logic", "proxy", "delete", id, ...ctx(server.url)
    ], { cwd, env });
    assert.equal(deleted.status, 1);
    assert.match(deleted.stderr + deleted.stdout, /Confirmation required|Cancelled|--yes/i);
    assert.equal(server.state.proxies.size, before);
    assert.equal(server.state.deleteIds.length, 0);
  } finally {
    await server.close();
  }
});
