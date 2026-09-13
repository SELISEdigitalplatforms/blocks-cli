import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import test from "node:test";

// `blocks git` end to end without GitHub: blocks-release is a fake JSON server
// and "GitHub" is a directory of bare repositories reached over file:// via
// BLOCKS_GITHUB_URL_BASE. Everything else -- the real git binary, the real
// blocks.json binding, the real error codes -- is exercised for real.

const repoRoot = resolve(import.meta.dirname, "..");
const bin = join(repoRoot, "bin", "run.js");
process.env.BLOCKS_NO_UPDATE_CHECK = "1";

async function makeWorkspace() {
  const base = await mkdtemp(join(tmpdir(), "blocks-git-test-"));
  const cwd = join(base, "workspace");
  const configDir = join(base, "config");
  const ghRoot = join(base, "github");
  await mkdir(cwd, { recursive: true });
  await mkdir(configDir, { recursive: true });
  await mkdir(join(ghRoot, "octo"), { recursive: true });
  return { base, cwd, configDir, ghRoot };
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

function testEnv(configDir, ghRoot, extra = {}) {
  return { ...process.env, BLOCKS_CONFIG_DIR: configDir, BLOCKS_SECRET_STORE: "file", BLOCKS_GITHUB_URL_BASE: `file://${ghRoot}`, ...extra };
}

// Async on purpose: the fake blocks-release server lives in this same process,
// so a blocking spawnSync would never let it answer the child's request.
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

function sh(cwd, args) {
  const result = spawnSync("git", ["-c", "user.name=test", "-c", "user.email=test@example.test", ...args], { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function bareRepo(ghRoot, fullName) {
  const path = join(ghRoot, `${fullName}.git`);
  sh(ghRoot, ["init", "--bare", "-q", "-b", "main", path]);
  return path;
}

/** Seeds a bare repo with one commit containing `files`, from a scratch clone. */
async function seedBare(base, ghRoot, fullName, files, message = "Remote seed") {
  const bare = bareRepo(ghRoot, fullName);
  const scratch = join(base, `seed-${fullName.replace("/", "-")}-${Date.now()}`);
  sh(base, ["clone", "-q", `file://${bare}`, scratch]);
  sh(scratch, ["checkout", "-q", "-b", "main"]);
  for (const [name, content] of Object.entries(files)) await writeFile(join(scratch, name), content);
  sh(scratch, ["add", "-A"]);
  sh(scratch, ["commit", "-q", "-m", message]);
  sh(scratch, ["push", "-q", "origin", "main"]);
  return bare;
}

function bareLog(bare) {
  return sh(bare, ["log", "--format=%s", "main"]).split("\n").filter(Boolean);
}

function rawResponse(status, body) {
  return body === undefined ? { __httpStatus: status } : { __httpBody: body, __httpStatus: status };
}

async function startReleaseServer(ghRoot, { credentialStatus = 200 } = {}) {
  const calls = { credential: 0, created: [] };
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const text = Buffer.concat(chunks).toString("utf8");
    const body = text ? JSON.parse(text) : undefined;
    const path = request.url.split("?")[0];
    let result;
    if (path === "/release/v4/Github/credential" && request.method === "GET") {
      calls.credential += 1;
      result = credentialStatus === 200
        ? { username: "x-access-token", token: "gh-token-secret", login: "octo", expiresAt: null }
        : rawResponse(credentialStatus, { isSuccess: false, message: "GitHub is not connected for this user." });
    } else if (path === "/release/v4/Github/repos" && request.method === "POST") {
      calls.created.push(body);
      const fullName = `${body.organization ?? "octo"}/${body.name}`;
      bareRepo(ghRoot, fullName);
      result = { isSuccess: true, data: { id: 1, name: body.name, full_name: fullName, html_url: `file://${ghRoot}/${fullName}` } };
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
  return { calls, close: () => new Promise((r) => { server.closeAllConnections(); server.close(r); }), url: `http://127.0.0.1:${port}` };
}

const exists = (path) => access(path).then(() => true, () => false);
const ctx = (url) => ["--account", "alpha", "--project", "target-project", "--api-url", url, "--json"];

test("git status: a plain directory is reported, not failed", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const result = await run(["git", "status", "--json"], { cwd, env: testEnv(configDir, ghRoot) });
  assert.equal(result.status, 0, result.stderr);
  const out = JSON.parse(result.stdout);
  assert.equal(out.isRepository, false);
  assert.equal(out.bound, null);
});

test("git init: creates the repository, commits, pushes and binds; a second init is refused", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "index.html"), "<h1>hi</h1>\n");
    await writeFile(join(cwd, "blocks.json"), `${JSON.stringify({ project: { tenantId: "target-project" } }, null, 2)}\n`);
    await mkdir(join(cwd, "node_modules", "x"), { recursive: true });
    await writeFile(join(cwd, "node_modules", "x", "index.js"), "// must not be committed\n");
    const env = testEnv(configDir, ghRoot);

    const dry = await run(["git", "init", "--dry-run", ...ctx(server.url)], { cwd, env });
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(JSON.parse(dry.stdout).dryRun, true);
    assert.equal(server.calls.credential, 0, "dry-run must not fetch a credential");

    const result = await run(["git", "init", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.created, true);
    assert.equal(out.pushed, true);
    assert.equal(out.initializedGit, true);
    assert.equal(out.repo.fullName, "octo/workspace");
    assert.equal(out.repo.branch, "main");

    assert.deepEqual(server.calls.created.map((c) => ({ name: c.name, private: c.private })), [{ name: "workspace", private: true }]);
    assert.deepEqual(bareLog(join(ghRoot, "octo", "workspace.git")), ["Initial commit from Blocks"]);
    const tracked = sh(cwd, ["ls-files"]).split("\n");
    assert.ok(tracked.includes("index.html"));
    assert.ok(tracked.includes(".gitignore"));
    assert.ok(!tracked.some((f) => f.startsWith("node_modules/")), "node_modules was committed");
    assert.match(await readFile(join(cwd, ".gitignore"), "utf8"), /node_modules\//);

    const config = JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8"));
    assert.equal(config.project.tenantId, "target-project", "existing blocks.json content is kept");
    assert.equal(config.repo.fullName, "octo/workspace");
    assert.ok(!(await readFile(join(cwd, ".git", "config"), "utf8")).includes("gh-token-secret"), "token leaked into .git/config");
    assert.ok(!result.stdout.includes("gh-token-secret"), "token leaked into output");

    const again = await run(["git", "init", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(again.status, 1);
    assert.match(again.stderr, /repo_already_bound/);
  } finally {
    await server.close();
  }
});

test("git init: without a GitHub connection it fails before touching the directory", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot, { credentialStatus: 404 });
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "index.html"), "x\n");
    const result = await run(["git", "init", "--yes", ...ctx(server.url)], { cwd, env: testEnv(configDir, ghRoot) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /github_not_connected/);
    assert.match(result.stderr, /Blocks portal/);
    assert.equal(await exists(join(cwd, ".git")), false, "git init ran despite no credential");
    assert.equal(server.calls.created.length, 0);
  } finally {
    await server.close();
  }
});

test("git push: commits and pushes what changed, then reports nothingToPush", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    await writeFile(join(cwd, "index.html"), "v1\n");
    const env = testEnv(configDir, ghRoot);
    assert.equal((await run(["git", "init", "--yes", ...ctx(server.url)], { cwd, env })).status, 0);

    await writeFile(join(cwd, "index.html"), "v2\n");
    const push = await run(["git", "push", "--yes", "--message", "Add the v2 heading", ...ctx(server.url)], { cwd, env });
    assert.equal(push.status, 0, push.stderr);
    const out = JSON.parse(push.stdout);
    assert.equal(out.pushed, true);
    assert.equal(out.committed, true);
    assert.deepEqual(bareLog(join(ghRoot, "octo", "workspace.git")), ["Add the v2 heading", "Initial commit from Blocks"]);

    const clean = await run(["git", "push", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(clean.status, 0, clean.stderr);
    assert.equal(JSON.parse(clean.stdout).nothingToPush, true);

    const status = JSON.parse((await run(["git", "status", "--json"], { cwd, env })).stdout);
    assert.equal(status.bound.fullName, "octo/workspace");
    assert.equal(status.ahead, 0);
    assert.deepEqual(status.dirtyFiles, []);
  } finally {
    await server.close();
  }
});

test("git push / pull / disconnect: without a binding they say so", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const env = testEnv(configDir, ghRoot);
  for (const cmd of ["push", "pull", "disconnect"]) {
    const result = await run(["git", cmd, "--yes", "--json"], { cwd, env });
    assert.equal(result.status, 1, cmd);
    assert.match(result.stderr, /repo_not_bound/, cmd);
  }
});

test("git clone: clones and binds; refuses a non-empty directory", async () => {
  const { base, cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    await seedBare(base, ghRoot, "octo/existing", { "README.md": "# existing\n" });
    const env = testEnv(configDir, ghRoot);

    const result = await run(["git", "clone", "octo/existing", "--dir", "cloned", ...ctx(server.url)], { cwd, env });
    assert.equal(result.status, 0, result.stderr);
    const out = JSON.parse(result.stdout);
    assert.equal(out.cloned, true);
    assert.equal(await readFile(join(cwd, "cloned", "README.md"), "utf8"), "# existing\n");
    const config = JSON.parse(await readFile(join(cwd, "cloned", "blocks.json"), "utf8"));
    assert.equal(config.repo.fullName, "octo/existing");
    assert.equal(config.project.tenantId, "target-project");

    const again = await run(["git", "clone", "octo/existing", "--dir", "cloned", ...ctx(server.url)], { cwd, env });
    assert.equal(again.status, 1);
    assert.match(again.stderr, /directory_not_empty/);
  } finally {
    await server.close();
  }
});

test("git connect: strategy is required; merge joins unrelated histories; a conflict aborts and pushes nothing", async () => {
  const { base, cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, ghRoot);
    const bare = await seedBare(base, ghRoot, "octo/both", { "README.md": "remote\n" });

    // Local: its own unrelated history.
    await writeFile(join(cwd, "index.html"), "local\n");
    sh(cwd, ["init", "-q", "-b", "main"]);
    sh(cwd, ["add", "-A"]);
    sh(cwd, ["commit", "-q", "-m", "Local start"]);

    const noStrategy = await run(["git", "connect", "octo/both", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(noStrategy.status, 1);
    assert.match(noStrategy.stderr, /strategy_required/);

    const bad = await run(["git", "connect", "octo/both", "--strategy", "yolo", "--yes", ...ctx(server.url)], { cwd, env });
    assert.match(bad.stderr, /invalid_strategy/);

    const merged = await run(["git", "connect", "octo/both", "--strategy", "merge", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(merged.status, 0, merged.stderr);
    assert.equal(JSON.parse(merged.stdout).connected, true);
    assert.equal(await readFile(join(cwd, "README.md"), "utf8"), "remote\n");
    assert.ok(bareLog(bare).includes("Local start"), "local history was not pushed");
    assert.equal(JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8")).repo.fullName, "octo/both");

    // Conflict: a second local repo whose README differs from the remote's.
    const other = join(base, "other");
    await mkdir(other);
    await writeFile(join(other, "README.md"), "mine\n");
    sh(other, ["init", "-q", "-b", "main"]);
    sh(other, ["add", "-A"]);
    sh(other, ["commit", "-q", "-m", "Other start"]);
    const before = bareLog(bare);
    const conflict = await run(["git", "connect", "octo/both", "--strategy", "merge", "--yes", ...ctx(server.url)], { cwd: other, env });
    assert.equal(conflict.status, 1);
    assert.match(conflict.stderr, /merge_conflict/);
    assert.deepEqual(bareLog(bare), before, "a conflicting merge must push nothing");
    assert.equal(sh(other, ["status", "--porcelain"]), "", "merge was not aborted cleanly");
    assert.equal(await exists(join(other, "blocks.json")), false, "binding written despite failure");
  } finally {
    await server.close();
  }
});

test("git connect --strategy adopt-remote replaces local content; keep-local replaces the remote", async () => {
  const { base, cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, ghRoot);
    const bare = await seedBare(base, ghRoot, "octo/adopt", { "README.md": "remote\n" });

    await writeFile(join(cwd, "index.html"), "local\n");
    sh(cwd, ["init", "-q", "-b", "main"]);
    sh(cwd, ["add", "-A"]);
    sh(cwd, ["commit", "-q", "-m", "Local start"]);

    const adopt = await run(["git", "connect", "octo/adopt", "--strategy", "adopt-remote", "--yes", ...ctx(server.url)], { cwd, env });
    assert.equal(adopt.status, 0, adopt.stderr);
    assert.equal(await readFile(join(cwd, "README.md"), "utf8"), "remote\n");
    assert.equal(await exists(join(cwd, "index.html")), false, "local-only file survived adopt-remote");
    // adopt-remote keeps the remote's history and adds exactly one commit on
    // top: the blocks.json binding, so the tree is clean afterwards.
    assert.deepEqual(bareLog(bare), ["Connect octo/adopt from Blocks", "Remote seed"]);
    assert.equal(sh(cwd, ["status", "--porcelain"]), "", "connect must leave a clean tree");
    assert.equal(JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8")).repo.fullName, "octo/adopt");

    // keep-local from a fresh directory over the same remote.
    const keep = join(base, "keep");
    await mkdir(keep);
    await writeFile(join(keep, "index.html"), "winner\n");
    sh(keep, ["init", "-q", "-b", "main"]);
    sh(keep, ["add", "-A"]);
    sh(keep, ["commit", "-q", "-m", "Keep local"]);
    const kept = await run(["git", "connect", "octo/adopt", "--strategy", "keep-local", "--yes", ...ctx(server.url)], { cwd: keep, env });
    assert.equal(kept.status, 0, kept.stderr);
    // keep-local: the remote now IS this directory's history (binding commit on top of it).
    assert.deepEqual(bareLog(bare), ["Connect octo/adopt from Blocks", "Keep local"]);
    assert.equal(sh(keep, ["status", "--porcelain"]), "", "connect must leave a clean tree");
  } finally {
    await server.close();
  }
});

test("git pull: refuses a dirty tree, then brings remote commits in; disconnect forgets only the binding", async () => {
  const { base, cwd, configDir, ghRoot } = await makeWorkspace();
  const server = await startReleaseServer(ghRoot);
  try {
    await writeProjectAuth(configDir, server.url);
    const env = testEnv(configDir, ghRoot);
    await writeFile(join(cwd, "index.html"), "v1\n");
    assert.equal((await run(["git", "init", "--yes", ...ctx(server.url)], { cwd, env })).status, 0);
    const bare = join(ghRoot, "octo", "workspace.git");

    // Someone else pushes.
    const elsewhere = join(base, "elsewhere");
    sh(base, ["clone", "-q", `file://${bare}`, elsewhere]);
    await writeFile(join(elsewhere, "NEW.md"), "from elsewhere\n");
    sh(elsewhere, ["add", "-A"]);
    sh(elsewhere, ["commit", "-q", "-m", "Elsewhere"]);
    sh(elsewhere, ["push", "-q", "origin", "main"]);

    await writeFile(join(cwd, "index.html"), "dirty\n");
    const dirty = await run(["git", "pull", ...ctx(server.url)], { cwd, env });
    assert.equal(dirty.status, 1);
    assert.match(dirty.stderr, /working_tree_dirty/);

    await writeFile(join(cwd, "index.html"), "v1\n");
    const pull = await run(["git", "pull", ...ctx(server.url)], { cwd, env });
    assert.equal(pull.status, 0, pull.stderr);
    assert.equal(JSON.parse(pull.stdout).changed, true);
    assert.equal(await readFile(join(cwd, "NEW.md"), "utf8"), "from elsewhere\n");

    const disconnect = await run(["git", "disconnect", "--yes", "--json"], { cwd, env });
    assert.equal(disconnect.status, 0, disconnect.stderr);
    assert.equal(JSON.parse(await readFile(join(cwd, "blocks.json"), "utf8")).repo, undefined);
    assert.equal(await exists(join(cwd, ".git")), true, ".git must survive disconnect");
    assert.equal(sh(cwd, ["remote", "get-url", "origin"]).length > 0, true, "remote must survive disconnect");
  } finally {
    await server.close();
  }
});

test("help: the git family is documented and lists every command", async () => {
  const { cwd, configDir, ghRoot } = await makeWorkspace();
  const result = await run(["help", "git", "--json"], { cwd, env: testEnv(configDir, ghRoot) });
  assert.equal(result.status, 0, result.stderr);
  const names = JSON.parse(result.stdout).commands.map((c) => c.name).sort();
  assert.deepEqual(names, ["git clone", "git connect", "git disconnect", "git init", "git pull", "git push", "git status"]);
});
