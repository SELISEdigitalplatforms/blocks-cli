import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-domain-test-"));
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

async function startDomainServer({ failMessage = null } = {}) {
  const state = { requests: [] };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const bodyText = Buffer.concat(chunks).toString("utf8");
    const path = request.url.split("?")[0];
    state.requests.push({ bodyText, method: request.method, path, url: request.url });

    if (path === "/os/v4/Domain/Configure" && request.method === "POST") {
      if (failMessage) {
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ isSuccess: false, message: failMessage }));
        return;
      }
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ isSuccess: true }));
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ message: "not found" }));
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const { port } = server.address();
  return { apiUrl: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)), state };
}

test("domain configure posts cookieDomain and reports configured (H1)", async () => {
  const ws = await makeWorkspace();
  const server = await startDomainServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["domain", "configure", "--cookie-domain", "app.example.com", "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.configured, true);
    assert.equal(out.cookieDomain, "app.example.com");
    assert.equal(server.state.requests.length, 1);
    assert.equal(server.state.requests[0].path, "/os/v4/Domain/Configure");
    assert.deepEqual(JSON.parse(server.state.requests[0].bodyText), { cookieDomain: "app.example.com" });
  } finally {
    await server.close();
  }
});

test("domain configure --dry-run does not call upstream (H4)", async () => {
  const ws = await makeWorkspace();
  const server = await startDomainServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["domain", "configure", "--cookie-domain", "app.example.com", "--dry-run", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dryRun, true);
    assert.equal(out.endpoint, "/os/v4/Domain/Configure");
    assert.equal(server.state.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("domain configure empty cookie-domain fails client-side (C1)", async () => {
  const ws = await makeWorkspace();
  const server = await startDomainServer();
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["domain", "configure", "--cookie-domain", "", "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "domain_missing_required_fields");
    assert.equal(out.message, "domain name is missing");
    assert.equal(server.state.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("domain configure surfaces upstream isSuccess false (C4)", async () => {
  const ws = await makeWorkspace();
  const server = await startDomainServer({ failMessage: "invalid domain format" });
  await writeProjectAuth(ws.configDir, server.apiUrl);
  try {
    const result = await run(
      ["domain", "configure", "--cookie-domain", "bad domain", "--yes", "--json"],
      { cwd: ws.cwd, env: testEnv(ws.configDir) }
    );
    assert.equal(result.status, 1, result.stderr);
    const out = JSON.parse(result.stderr);
    assert.equal(out.code, "domain_configure_failed");
    assert.equal(out.message, "invalid domain format");
  } finally {
    await server.close();
  }
});
