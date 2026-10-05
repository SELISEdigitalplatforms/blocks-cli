import { stringFlag, booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  GIT_NETWORK_TIMEOUT_MS, expectOk, fetchPushCredential, git, isGitRepository,
  readRepoBinding, requireGitRepository, requireRepoBinding
} from "../../../lib/git.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Creates a new branch from the connected repository and pushes it, without
 * switching the workspace off its currently connected branch: `blocks git
 * push`/`pull` keep targeting the branch in blocks.json exactly as before, so
 * creating a branch is additive and never redirects an in-progress build.
 * Uses `git branch` (not `checkout -b`) for that reason — the workspace's
 * checked-out HEAD is never touched.
 */
export async function gitBranchCreate(argv: string[]): Promise<void> {
  const { flags, args } = parseCommand(argv);
  const cwd = process.cwd();
  const binding = requireRepoBinding(await readRepoBinding());
  requireGitRepository(await isGitRepository(cwd));

  const name = args[0] || stringFlag(flags, "name");
  if (!name) {
    throw new CliActionableError("A branch name is required.", "missing_branch_name", "Pass the name: blocks git branch create <name>.");
  }

  const base = stringFlag(flags, "from", { defaultValue: binding.branch });
  const dryRun = booleanFlag(flags, "dry-run");

  const plan = { base, branch: name, repository: binding.fullName };
  if (dryRun) {
    writeOutput({ ...plan, dryRun: true }, flags);
    return;
  }

  await confirmMutation(flags, `Create branch '${name}' from '${base}' on ${binding.fullName} and push it.`);

  const projectKey = await selectedProject(flags);
  const credential = await fetchPushCredential(projectKey, flags);

  const created = await git(["branch", name, base], { cwd });
  expectOk(created, `git branch ${name} ${base}`, "branch_create_failed",
    /already exists/i.test(created.stderr)
      ? `'${name}' already exists locally. Choose a different name, or push it with 'blocks git branch create' skipped.`
      : `Check that '${base}' is a valid starting point (a local branch, or a commit sha).`);

  const push = await git(["push", "origin", `${name}:refs/heads/${name}`], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  expectOk(push, `git push origin ${name}`, "push_rejected", "Check the error above and retry.");

  const sha = await git(["rev-parse", name], { cwd });
  const commit = sha.code === 0 ? sha.stdout.trim() : null;

  writeOutput({ base, branch: name, commit, created: true, pushed: true, repo: binding }, flags);
}
