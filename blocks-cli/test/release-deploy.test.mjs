import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-deploy-test-"));
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
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", ...extra };
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

async function startDeployServer({ repos = [], assets = [] } = {}) {
  const calls = { reposList: 0, getAsset: 0, repoDetails: 0 };
  const server = createServer(async (request, response) => {
    const path = request.url.split("?")[0];
    let result;
    if (path === "/os/v4/Project/Gets" && request.method === "GET") {
      result = [{
        tenantGroupId: "tg-1",
        projects: [{ tenantId: "target-project", name: "Target", environment: "dev" }]
      }];
    } else if (path === "/release/v4/Build/repos-list" && request.method === "GET") {
      calls.reposList += 1;
      result = { isSuccess: true, data: repos };
    } else if (path === "/os/v4/Project/GetAsset" && request.method === "GET") {
      calls.getAsset += 1;
      result = { assets: { resources: assets } };
    } else if (path === "/release/v4/Build/repo-details" && request.method === "GET") {
      calls.repoDetails += 1;
      const url = new URL(request.url, "http://local");
      const repoId = url.searchParams.get("RepoId");
      const repo = repos.find((r) => (r.itemId || r.id) === repoId);
      if (repo) {
        result = { data: { repo: { branch: repo.branch, repoUrl: repo.repoUrl } } };
      } else if (assets.some((a) => a.resourceId === repoId)) {
        result = { data: { repo: { branch: "dev", repoUrl: `https://github.com/portal/${repoId}` } } };
      } else {
        result = rawResponse(404, { message: "not found" });
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
    calls,
    close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }),
    url: `http://127.0.0.1:${port}`
  };
}

const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

test("release deploy: workspace-binding resolves without Project/GetAsset", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const repos = [{
    itemId: "repo-1",
    repoName: "acme/web-app",
    repoUrl: "https://github.com/acme/web-app",
    branch: "dev"
  }];
  const server = await startDeployServer({ repos });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({
      project: { tenantId: "target-project" },
      repo: { provider: "github", fullName: "acme/web-app", url: "https://github.com/acme/web-app", branch: "main" }
    }, null, 2)}\n`);
    const result = await run(["release", "deploy", "--dry-run", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.repoSource, "workspace-binding");
    assert.equal(out.repoId, "repo-1");
    assert.equal(out.repoLabel, "acme/web-app");
    assert.equal(server.calls.getAsset, 0);
  } finally {
    await server.close();
  }
});

test("release deploy: repos-list-match when no binding and exactly one env branch", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const repos = [{
    itemId: "repo-solo",
    repoName: "acme/solo",
    repoUrl: "https://github.com/acme/solo",
    branch: "dev"
  }];
  const server = await startDeployServer({ repos });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({ project: { tenantId: "target-project" } }, null, 2)}\n`);
    const result = await run(["release", "deploy", "--dry-run", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.repoSource, "repos-list-match");
    assert.equal(out.repoId, "repo-solo");
    assert.equal(server.calls.getAsset, 0);
  } finally {
    await server.close();
  }
});

test("release deploy: repo_ambiguous when multiple env matches and no binding", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const repos = [
    { itemId: "a", repoName: "acme/a", repoUrl: "https://github.com/acme/a", branch: "dev" },
    { itemId: "b", repoName: "acme/b", repoUrl: "https://github.com/acme/b", branch: "dev" }
  ];
  const server = await startDeployServer({ repos });
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["release", "deploy", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /repo_ambiguous/);
  } finally {
    await server.close();
  }
});

test("release deploy: repo_not_linked when nothing matches", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startDeployServer({ repos: [], assets: [] });
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["release", "deploy", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /repo_not_linked/);
    assert.match(result.stderr, /blocks git init/);
  } finally {
    await server.close();
  }
});

test("release deploy: project-asset legacy path when no binding/repos", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const server = await startDeployServer({
    repos: [],
    assets: [{ name: "dev", resourceId: "asset-repo-9" }]
  });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({ project: { tenantId: "target-project" } }, null, 2)}\n`);
    const result = await run(["release", "deploy", "--dry-run", ...ctx(server.url)], { cwd, env: testEnv(configDir) });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.repoSource, "project-asset");
    assert.equal(out.repoId, "asset-repo-9");
    assert.equal(server.calls.getAsset, 1);
  } finally {
    await server.close();
  }
});

test("release deploy: explicit --repo sets repoSource explicit", async () => {
  const { cwd, configDir } = await makeWorkspace();
  const repos = [
    { itemId: "a", repoName: "acme/a", repoUrl: "https://github.com/acme/a", branch: "dev" },
    { itemId: "b", repoName: "acme/b", repoUrl: "https://github.com/acme/b", branch: "dev" }
  ];
  const server = await startDeployServer({ repos });
  try {
    await writeProjectAuth(configDir, server.url);
    const result = await run(["release", "deploy", "--repo", "acme/b", "--dry-run", ...ctx(server.url)], {
      cwd,
      env: testEnv(configDir)
    });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.repoSource, "explicit");
    assert.equal(out.repoId, "b");
  } finally {
    await server.close();
  }
});
