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
  const base = await mkdtemp(join(tmpdir(), "blocks-github-test-"));
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

async function startServer({ approveAfterPolls = Infinity, clientId = "Iv1.test-client" } = {}) {
  const state = { credentialPolls: 0, approved: false };
  const html = `<!doctype html><html><body><script>window.__BLOCKS_ENV__ = { BLOCKS_GITHUB_SSO_CLIENT_ID: "${clientId}" };</script></body></html>`;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const path = request.url.split("?")[0];
    let result;
    if ((path === "/" || path === "/index.html") && request.method === "GET") {
      response.setHeader("content-type", "text/html");
      response.end(html);
      return;
    }
    if (path === "/release/v4/Github/credential" && request.method === "GET") {
      state.credentialPolls += 1;
      if (state.credentialPolls >= approveAfterPolls) state.approved = true;
      result = state.approved
        ? { username: "x-access-token", token: "gh-token-secret", login: "octocat", expiresAt: null }
        : rawResponse(404, { isSuccess: false, message: "GitHub is not connected for this user." });
    } else if (path === "/os/v4/Project/Gets" && request.method === "GET") {
      result = [{
        tenantGroupId: "tg-1",
        projects: [{ tenantId: "target-project", name: "Target", environment: "dev" }]
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

test("github connect: opens authorize URL and reports connected after credential appears", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ approveAfterPolls: 2, clientId: "Iv1.happy" });
  try {
    await writeProjectAuth(configDir, server.url);
    // Default BLOCKS_OPEN_BROWSER=0 skips launch; authorize URL is printed to stderr under --json.
    const env = testEnv(configDir);
    // Force HTML scrape (no env client id).
    delete env.BLOCKS_GITHUB_SSO_CLIENT_ID;

    const result = await run(["github", "connect", "--timeout", "30", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const out = JSON.parse(result.stdout);
    assert.equal(out.connected, true);
    assert.equal(out.login, "octocat");
    assert.deepEqual(out.scopes, ["repo", "user:email", "read:user", "read:repo_hook"]);

    assert.match(result.stderr, /URL: https:\/\/github\.com\/login\/oauth\/authorize\?/);
    assert.match(result.stderr, /client_id=Iv1\.happy/);
    assert.match(result.stderr, /scope=repo\+user%3Aemail\+read%3Auser\+read%3Arepo_hook/);
    assert.ok(server.state.credentialPolls >= 2);
  } finally {
    await server.close();
  }
});

test("github status: reports connected login without opening a browser", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ approveAfterPolls: 0 });
  try {
    await writeProjectAuth(configDir, server.url);
    server.state.approved = true;
    const env = testEnv(configDir, { BLOCKS_GITHUB_SSO_CLIENT_ID: "unused" });
    const result = await run(["github", "status", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { connected: true, login: "octocat" });
    // status never prints an authorize URL (no browser path).
    assert.doesNotMatch(result.stderr, /URL: https:\/\/github\.com\/login\/oauth\/authorize/);
  } finally {
    await server.close();
  }
});

test("github connect: times out when credential never appears", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer({ approveAfterPolls: Infinity });
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, { BLOCKS_GITHUB_SSO_CLIENT_ID: "Iv1.timeout" });
    const started = Date.now();
    const result = await run(["github", "connect", "--timeout", "1", ...ctx(server.url)], { cwd, env });
    const elapsed = Date.now() - started;
    assert.equal(result.status, 1);
    assert.match(result.stderr, /github_connect_timeout/);
    assert.ok(elapsed < 15_000, `timeout took too long: ${elapsed}ms`);
  } finally {
    await server.close();
  }
});

test("github connect --dry-run: prints plan without polling or opening browser", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startServer();
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, { BLOCKS_GITHUB_SSO_CLIENT_ID: "Iv1.dry" });
    const result = await run(["github", "connect", "--dry-run", "--timeout", "120", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.dryRun, true);
    assert.equal(out.timeoutSeconds, 120);
    assert.equal(out.pollIntervalSeconds, 5);
    assert.match(out.authorizeUrl, /client_id=Iv1\.dry/);
    assert.equal(server.state.credentialPolls, 0);
    // dry-run must not print the live progress URL line (no browser open).
    assert.doesNotMatch(result.stderr, /URL: https:\/\/github\.com\/login\/oauth\/authorize/);
  } finally {
    await server.close();
  }
});

test("github connect: fails before browser when client id cannot be resolved", async () => {
  const { cwd, configDir } = await makeWorkspace();
  // Server with no index.html client id and no env override.
  const server = createServer((request, response) => {
    response.statusCode = 404;
    response.end("missing");
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}`;
  try {
    await writeProjectAuth(configDir, url);
    // Also need Project/Gets for resolveSelectedProject — make it succeed via a smarter server?
    // resolveSelectedProject runs first; 404 on Project/Gets would fail earlier.
  } finally {
    await new Promise((r) => { server.closeAllConnections(); server.close(r); });
  }

  const good = await startServer({ clientId: "will-clear" });
  // Override HTML to omit client id by using a custom server
  await good.close();

  const state = { polls: 0 };
  const bare = createServer(async (request, response) => {
    const path = request.url.split("?")[0];
    if (path === "/os/v4/Project/Gets") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify([{
        tenantGroupId: "tg-1", projects: [{ tenantId: "target-project", name: "Target", environment: "dev" }]
      }]));
      return;
    }
    if (path === "/" || path === "/index.html") {
      response.setHeader("content-type", "text/html");
      response.end("<html><body>no env</body></html>");
      return;
    }
    state.polls += 1;
    response.statusCode = 404;
    response.end("{}");
  });
  await new Promise((r) => bare.listen(0, "127.0.0.1", r));
  const bareUrl = `http://127.0.0.1:${bare.address().port}`;
  try {
    await writeProjectAuth(configDir, bareUrl);
    const env = testEnv(configDir);
    delete env.BLOCKS_GITHUB_SSO_CLIENT_ID;
    delete env.BLOCKS_RELEASE_WEB_URL;
    const result = await run(["github", "connect", "--timeout", "5", ...ctx(bareUrl)], { cwd, env });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /github_client_id_unavailable/);
    assert.doesNotMatch(result.stderr, /URL: https:\/\/github\.com\/login\/oauth\/authorize/);
    assert.equal(state.polls, 0, "must not poll credential before client id resolves");
  } finally {
    await new Promise((r) => { bare.closeAllConnections(); bare.close(r); });
  }
});
