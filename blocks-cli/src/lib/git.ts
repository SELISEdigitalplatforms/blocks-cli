import { execFile } from "node:child_process";
import { chmod, mkdtemp, rm, writeFile, readFile, appendFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { blocksRequest } from "./api.js";
import { CliActionableError } from "./errors.js";
import { RELEASE_API, ReleaseEnvelope } from "./release.js";
import { requestContext } from "./request-context.js";
import { BlocksWorkspaceConfig, readWorkspaceConfig, writeWorkspaceConfig } from "./workspace.js";

/**
 * Local git plumbing for the `blocks git` family.
 *
 * Studio consumes these commands too (its post-run push and pre-run pull are
 * `blocks git push` / `blocks git pull` run inside the app's sandbox), so two
 * rules hold everywhere here and are worth stating once:
 *
 * 1. **The credential never touches disk in the repository.** It reaches git
 *    through `GIT_ASKPASS` for the lifetime of one process — a throwaway
 *    script in a 0700 temp dir that echoes an environment variable — and is
 *    never written into `.git/config`, a remote URL, or `blocks.json`. A
 *    workspace that is later zipped, pushed, or bind-mounted somewhere else
 *    therefore carries nothing that authenticates as the owner.
 * 2. **Nothing here decides history.** Every destructive choice (force-push,
 *    reset to remote, unrelated-history merge) is an explicit `--strategy`
 *    the caller spells out; this module refuses to guess.
 */

export type GitResult = { code: number; stdout: string; stderr: string };

export type GitCredential = { username: string; token: string; login?: string };

export type RepoBinding = {
  provider: "github";
  /** `owner/name` — what GitHub calls full_name. */
  fullName: string;
  /** Browser URL of the repository (html_url); the push URL is this plus `.git`. */
  url: string;
  branch: string;
};

const DEFAULT_TIMEOUT_MS = 120_000;
const NETWORK_TIMEOUT_MS = 600_000;
const DEFAULT_BRANCH = "main";

/** Lines every generated-app repository should ignore; appended only if missing. */
export const DEFAULT_GITIGNORE = ["node_modules/", "dist/", ".env", ".env.local", ".env.*.local", ".cert/"];

/**
 * Where repositories live. Overridable for GitHub Enterprise and for tests,
 * which point it at a directory of bare repositories over file:// so a whole
 * init -> push -> clone -> pull cycle runs without a network.
 */
export function githubBaseUrl(): string {
  return (process.env.BLOCKS_GITHUB_URL_BASE || "https://github.com").replace(/\/+$/, "");
}

export function repoFullNameOf(input: string): string {
  const base = githubBaseUrl();
  let trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith(`${base.toLowerCase()}/`)) trimmed = trimmed.slice(base.length + 1);
  trimmed = trimmed.replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) {
    throw new CliActionableError(
      `'${input}' is not a repository name. Expected 'owner/name'.`,
      "invalid_repo_name",
      "Pass the repository as owner/name, e.g. acme/web-app, or its github.com URL."
    );
  }
  return trimmed;
}

export function repoUrlOf(fullName: string): string {
  return `${githubBaseUrl()}/${fullName}`;
}

export function pushUrlOf(fullName: string): string {
  return `${repoUrlOf(fullName)}.git`;
}

// ---------------------------------------------------------------- process --

export async function git(
  args: string[],
  options: { cwd: string; credential?: GitCredential; env?: NodeJS.ProcessEnv; timeoutMs?: number; identity?: string } = { cwd: process.cwd() }
): Promise<GitResult> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...options.env,
    // Never let git block on a prompt: a headless run (Studio's sandbox) has
    // nobody to answer, and would otherwise hang until the timeout.
    GIT_TERMINAL_PROMPT: "0",
    GIT_CONFIG_NOSYSTEM: "1"
  };

  // Commit identity is supplied per command, never written to the repo's
  // config: the workspace may be shared, and a stale user.email in
  // .git/config is exactly the kind of thing that outlives its author.
  const identity = options.identity ?? "blocks-cli";
  const prefix = [
    "-c", `user.name=${identity}`,
    "-c", `user.email=${identity.replace(/[^A-Za-z0-9._-]/g, "-")}@users.noreply.github.com`,
    "-c", "init.defaultBranch=main",
    "-c", "advice.detachedHead=false"
  ];

  let askpassDir: string | undefined;
  try {
    if (options.credential) {
      askpassDir = await mkdtemp(join(tmpdir(), "blocks-git-askpass-"));
      const askpass = await writeAskpassScript(askpassDir);
      env.GIT_ASKPASS = askpass;
      env.BLOCKS_GIT_ASKPASS_USERNAME = options.credential.username;
      env.BLOCKS_GIT_ASKPASS_TOKEN = options.credential.token;
    }

    const result = await runProcess("git", [...prefix, ...args], { cwd: options.cwd, env, timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS });
    if (options.credential) {
      // Belt and braces: git never prints the askpass answer, but a remote
      // helper might echo a URL it built. Scrub before anything is shown.
      result.stdout = scrub(result.stdout, options.credential.token);
      result.stderr = scrub(result.stderr, options.credential.token);
    }
    return result;
  } finally {
    if (askpassDir) await rm(askpassDir, { recursive: true, force: true });
  }
}

async function writeAskpassScript(dir: string): Promise<string> {
  if (process.platform === "win32") {
    const path = join(dir, "askpass.cmd");
    await writeFile(path, [
      "@echo off",
      "echo %1 | findstr /i \"sername\" >nul",
      "if %errorlevel%==0 (echo %BLOCKS_GIT_ASKPASS_USERNAME%) else (echo %BLOCKS_GIT_ASKPASS_TOKEN%)",
      ""
    ].join("\r\n"));
    return path;
  }

  const path = join(dir, "askpass.sh");
  await writeFile(path, [
    "#!/bin/sh",
    "case \"$1\" in",
    "  *sername*) printf '%s\\n' \"$BLOCKS_GIT_ASKPASS_USERNAME\" ;;",
    "  *) printf '%s\\n' \"$BLOCKS_GIT_ASKPASS_TOKEN\" ;;",
    "esac",
    ""
  ].join("\n"));
  await chmod(path, 0o700);
  return path;
}

function scrub(text: string, secret: string): string {
  return secret ? text.split(secret).join("***") : text;
}

function runProcess(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; timeoutMs: number }
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd: options.cwd, env: options.env, timeout: options.timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (error, stdout, stderr) => {
        if (error && "code" in error && error.code === "ENOENT") {
          reject(new CliActionableError(
            "git is not installed or not on PATH.",
            "git_not_installed",
            "Install git (https://git-scm.com) and re-run."
          ));
          return;
        }
        const code = error && typeof (error as NodeJS.ErrnoException).code === "number"
          ? (error as unknown as { code: number }).code
          : error ? 1 : 0;
        if (error && (error as { killed?: boolean }).killed) {
          reject(new CliActionableError(`git ${args.find((a) => !a.startsWith("-")) ?? ""} timed out.`, "git_timeout", "Check network access to GitHub and retry."));
          return;
        }
        resolve({ code, stdout: String(stdout), stderr: String(stderr) });
      });
  });
}

/** Throws a CliActionableError carrying git's own stderr when `result` failed. */
export function expectOk(result: GitResult, what: string, code = "git_command_failed", nextStep?: string): GitResult {
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout).trim();
    throw new CliActionableError(`${what} failed${detail ? `: ${detail}` : "."}`, code, nextStep);
  }
  return result;
}

// -------------------------------------------------------------- repo state --

export async function isGitRepository(cwd: string): Promise<boolean> {
  const result = await git(["rev-parse", "--is-inside-work-tree"], { cwd });
  return result.code === 0 && result.stdout.trim() === "true";
}

export function requireGitRepository(isRepo: boolean): void {
  if (!isRepo) {
    throw new CliActionableError(
      "This directory is not a git repository.",
      "not_a_git_repository",
      "Run 'blocks git init' to create one and push it, or 'blocks git clone <owner/name>' to start from an existing repository."
    );
  }
}

export async function currentBranch(cwd: string): Promise<string | undefined> {
  const result = await git(["symbolic-ref", "--short", "-q", "HEAD"], { cwd });
  return result.code === 0 ? result.stdout.trim() || undefined : undefined;
}

export async function hasCommits(cwd: string): Promise<boolean> {
  return (await git(["rev-parse", "--verify", "-q", "HEAD"], { cwd })).code === 0;
}

export async function headSha(cwd: string): Promise<string | undefined> {
  const result = await git(["rev-parse", "HEAD"], { cwd });
  return result.code === 0 ? result.stdout.trim() : undefined;
}

export async function dirtyFiles(cwd: string): Promise<string[]> {
  const result = expectOk(await git(["status", "--porcelain", "--untracked-files=all"], { cwd }), "git status");
  return result.stdout.split("\n").map((line) => line.trimEnd()).filter(Boolean);
}

export async function aheadBehind(cwd: string, branch: string, remote = "origin"): Promise<{ ahead: number; behind: number } | undefined> {
  const result = await git(["rev-list", "--left-right", "--count", `${branch}...${remote}/${branch}`], { cwd });
  if (result.code !== 0) return undefined;
  const [ahead, behind] = result.stdout.trim().split(/\s+/).map((n) => Number.parseInt(n, 10));
  return { ahead: ahead || 0, behind: behind || 0 };
}

export async function remoteUrl(cwd: string, name = "origin"): Promise<string | undefined> {
  const result = await git(["remote", "get-url", name], { cwd });
  return result.code === 0 ? result.stdout.trim() : undefined;
}

export async function setRemote(cwd: string, url: string, name = "origin"): Promise<void> {
  const existing = await remoteUrl(cwd, name);
  if (existing === undefined) {
    expectOk(await git(["remote", "add", name, url], { cwd }), `git remote add ${name}`);
  } else if (existing !== url) {
    expectOk(await git(["remote", "set-url", name, url], { cwd }), `git remote set-url ${name}`);
  }
}

export async function initRepository(cwd: string, branch: string): Promise<void> {
  const modern = await git(["init", "-b", branch], { cwd });
  if (modern.code === 0) return;
  // git < 2.28 has no -b: init, then point HEAD at the wanted branch.
  expectOk(await git(["init"], { cwd }), "git init");
  expectOk(await git(["symbolic-ref", "HEAD", `refs/heads/${branch}`], { cwd }), "git symbolic-ref");
}

/** Stages everything and commits. Returns the new sha, or undefined when there was nothing to commit. */
export async function commitAll(cwd: string, message: string, identity?: string): Promise<string | undefined> {
  expectOk(await git(["add", "-A"], { cwd }), "git add");
  const staged = await git(["diff", "--cached", "--quiet"], { cwd });
  const hasHead = await hasCommits(cwd);
  // `diff --cached --quiet` exits 1 when something is staged. Before the first
  // commit it compares against an empty tree, so the same test works there.
  if (staged.code === 0 && hasHead) return undefined;
  if (staged.code === 0 && !hasHead) {
    // Empty directory: nothing to commit and nothing to push. Say so instead
    // of creating an empty root commit nobody asked for.
    return undefined;
  }
  expectOk(await git(["commit", "-q", "-m", message], { cwd, identity }), "git commit");
  return headSha(cwd);
}

export async function ensureGitignore(cwd: string, entries: readonly string[] = DEFAULT_GITIGNORE): Promise<string[]> {
  const path = join(cwd, ".gitignore");
  let current = "";
  try {
    current = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const present = new Set(current.split("\n").map((line) => line.trim()));
  const missing = entries.filter((entry) => !present.has(entry));
  if (missing.length === 0) return [];
  const separator = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
  await appendFile(path, `${separator}${missing.join("\n")}\n`);
  return missing;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- blocks.json --

type WorkspaceWithRepo = BlocksWorkspaceConfig & { repo?: RepoBinding };

export async function readRepoBinding(): Promise<RepoBinding | undefined> {
  const config = (await readWorkspaceConfig()) as WorkspaceWithRepo;
  const repo = config.repo;
  if (!repo?.fullName) return undefined;
  return { provider: "github", fullName: repo.fullName, url: repo.url ?? repoUrlOf(repo.fullName), branch: repo.branch ?? DEFAULT_BRANCH };
}

export function requireRepoBinding(binding: RepoBinding | undefined): RepoBinding {
  if (!binding) {
    throw new CliActionableError(
      "No repository is connected to this workspace (no 'repo' entry in blocks.json).",
      "repo_not_bound",
      "Run 'blocks git init' to create and push a new repository, or 'blocks git connect <owner/name>' to attach an existing one."
    );
  }
  return binding;
}

export async function writeRepoBinding(binding: RepoBinding): Promise<void> {
  const config = (await readWorkspaceConfig()) as WorkspaceWithRepo;
  await writeWorkspaceConfig({ ...config, repo: binding } as BlocksWorkspaceConfig);
}

export async function clearRepoBinding(): Promise<RepoBinding | undefined> {
  const config = (await readWorkspaceConfig()) as WorkspaceWithRepo;
  const { repo, ...rest } = config;
  if (repo) await writeWorkspaceConfig(rest as BlocksWorkspaceConfig);
  return repo;
}

// ------------------------------------------------------------- blocks-release --

type CredentialResponse = { username?: string; token?: string; login?: string; expiresAt?: string | null };

/**
 * The calling user's GitHub credential from blocks-release. A 404 means
 * GitHub was never connected (or the token was revoked) and is surfaced as
 * `github_not_connected` so an agent stops here instead of retrying a push
 * that cannot succeed.
 */
export async function fetchPushCredential(projectKey: string, flags: Record<string, string | boolean>): Promise<GitCredential> {
  let response: CredentialResponse;
  try {
    response = await blocksRequest<CredentialResponse>(`${RELEASE_API}/Github/credential`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message)) {
      throw new CliActionableError(
        "GitHub is not connected for this Blocks account, or the connection is no longer valid.",
        "github_not_connected",
        "Connect GitHub from the Blocks portal (Repositories -> Connect GitHub), then re-run."
      );
    }
    throw error;
  }
  if (!response?.token) {
    throw new CliActionableError("blocks-release returned no GitHub credential.", "github_credential_missing", "Reconnect GitHub from the Blocks portal, then re-run.");
  }
  return { username: response.username || "x-access-token", token: response.token, login: response.login };
}

type CreatedRepo = { full_name?: string; html_url?: string; name?: string; id?: number };

export async function createRemoteRepository(
  request: { name: string; description?: string; isPrivate: boolean; organization?: string },
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<{ fullName: string; url: string }> {
  let envelope: ReleaseEnvelope<CreatedRepo>;
  try {
    envelope = await blocksRequest<ReleaseEnvelope<CreatedRepo>>(`${RELEASE_API}/Github/repos`, {
      body: { name: request.name, description: request.description, private: request.isPrivate, organization: request.organization },
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(
      `Could not create the GitHub repository '${request.name}': ${message}`,
      "remote_create_failed",
      "If a repository with that name already exists, re-run with --repo <owner/name> to use it instead."
    );
  }
  const repo = envelope?.data;
  if (!repo?.full_name) {
    throw new CliActionableError("blocks-release created the repository but returned no name for it.", "remote_create_failed", "Check the repository on GitHub, then 'blocks git connect <owner/name>'.");
  }
  return { fullName: repo.full_name, url: repo.html_url ?? repoUrlOf(repo.full_name) };
}

export const GIT_DEFAULT_BRANCH = DEFAULT_BRANCH;
export const GIT_NETWORK_TIMEOUT_MS = NETWORK_TIMEOUT_MS;
