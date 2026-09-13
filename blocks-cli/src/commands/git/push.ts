import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import {
  GIT_NETWORK_TIMEOUT_MS, aheadBehind, commitAll, dirtyFiles, ensureGitignore, expectOk, fetchPushCredential, git, headSha, isGitRepository,
  pushUrlOf, readRepoBinding, requireGitRepository, requireRepoBinding, setRemote
} from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Scenario D — commit whatever changed and push the connected branch. This is
 * the command Studio runs after a successful build, with --message set to the
 * run's own summary and --yes because no one is at the terminal. With nothing
 * to commit and nothing ahead it exits 0 and says `nothingToPush: true`.
 */
export async function gitPush(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cwd = process.cwd();
  const binding = requireRepoBinding(await readRepoBinding());
  requireGitRepository(await isGitRepository(cwd));
  const dryRun = booleanFlag(flags, "dry-run");
  const message = stringFlag(flags, "message", { defaultValue: "Update from Blocks" });

  const pending = await dirtyFiles(cwd);
  const counts = await aheadBehind(cwd, binding.branch);
  const plan = { branch: binding.branch, commitPending: pending.length > 0, pendingFiles: pending.length, repository: binding.fullName, unpushedCommits: counts?.ahead ?? null };
  if (dryRun) {
    writeOutput({ ...plan, dryRun: true }, flags);
    return;
  }

  if (pending.length === 0 && counts && counts.ahead === 0) {
    writeOutput({ branch: binding.branch, commit: (await headSha(cwd)) ?? null, nothingToPush: true, pushed: false, repo: binding }, flags);
    return;
  }

  await confirmMutation(flags, `Push ${pending.length > 0 ? `${pending.length} changed file(s) as a new commit` : `${counts?.ahead ?? "pending"} commit(s)`} to ${binding.fullName} (${binding.branch}).`);

  const projectKey = await selectedProject(flags);
  const credential = await fetchPushCredential(projectKey, flags);
  await ensureGitignore(cwd);
  const commit = pending.length > 0 ? await commitAll(cwd, message, credential.login) : undefined;
  await setRemote(cwd, pushUrlOf(binding.fullName));

  const push = await git(["push", "-u", "origin", binding.branch], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  expectOk(push, `git push origin ${binding.branch}`, "push_rejected",
    /rejected|non-fast-forward|fetch first/i.test(push.stderr)
      ? "The remote has commits this workspace doesn't. Run 'blocks git pull' first, then push again."
      : "Check the error above and retry.");

  writeOutput({ branch: binding.branch, commit: commit ?? (await headSha(cwd)) ?? null, committed: Boolean(commit), nothingToPush: false, pushed: true, repo: binding }, flags);
}
