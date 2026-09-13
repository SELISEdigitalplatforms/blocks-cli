import { readdir } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { stringFlag } from "../../lib/args.js";
import { CliActionableError } from "../../lib/errors.js";
import { GIT_NETWORK_TIMEOUT_MS, commitAll, currentBranch, expectOk, fetchPushCredential, git, pathExists, pushUrlOf, repoFullNameOf, repoUrlOf } from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";
import { readFile, writeFile } from "node:fs/promises";

/**
 * Scenario B — the code exists on GitHub and not here. Clones into --dir
 * (default: the repository name) and writes the binding plus the selected
 * project into that directory's blocks.json, so the next `blocks` command run
 * inside it already knows both its project and its repository.
 *
 * Refuses a non-empty target directory rather than merging into it: that is
 * `blocks git connect`'s job, with an explicit strategy.
 */
export async function gitClone(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const source = args[0] || stringFlag(flags, "repo", { required: true });
  const fullName = repoFullNameOf(source);
  const branch = stringFlag(flags, "branch") || undefined;
  const dir = resolve(stringFlag(flags, "dir") || basename(fullName));

  if (await pathExists(dir)) {
    const entries = await readdir(dir);
    if (entries.length > 0) {
      throw new CliActionableError(
        `Directory '${dir}' already exists and is not empty.`,
        "directory_not_empty",
        "Pass --dir <empty-or-new-path>, or run 'blocks git connect' inside that directory to attach it to the repository."
      );
    }
  }

  const projectKey = await selectedProject(flags);
  const credential = await fetchPushCredential(projectKey, flags);

  const cloneArgs = ["clone", "--quiet", ...(branch ? ["--branch", branch] : []), pushUrlOf(fullName), dir];
  expectOk(await git(cloneArgs, { cwd: process.cwd(), credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS }), `git clone ${fullName}`, "clone_failed",
    "Check that the repository exists and the connected GitHub account can read it.");

  const clonedBranch = (await currentBranch(dir)) ?? branch ?? "main";
  const binding = { branch: clonedBranch, fullName, provider: "github" as const, url: repoUrlOf(fullName) };

  // Merge, don't replace: a repository may already carry a blocks.json with
  // data/localization paths its owner chose.
  const configPath = join(dir, "blocks.json");
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(configPath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const project = { ...((existing.project as Record<string, unknown> | undefined) ?? {}) };
  if (!project.tenantId) project.tenantId = projectKey;
  await writeFile(configPath, `${JSON.stringify({ ...existing, project, repo: binding }, null, 2)}\n`);
  // Committed locally (not pushed) so the clone starts clean; a repository
  // created by `blocks git init` already carries this binding, in which case
  // there is nothing to commit and the clone is exactly at origin.
  const bindCommit = await commitAll(dir, "Bind to Blocks project", credential.login);

  writeOutput({ bindingCommitted: Boolean(bindCommit), cloned: true, directory: dir, next: [`cd ${basename(dir)}`, "npm install", "npm run dev"], repo: binding }, flags);
}
