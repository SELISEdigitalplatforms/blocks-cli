import { booleanFlag } from "../../lib/args.js";
import { CliActionableError } from "../../lib/errors.js";
import { GIT_NETWORK_TIMEOUT_MS, dirtyFiles, expectOk, fetchPushCredential, git, headSha, isGitRepository, readRepoBinding, requireGitRepository, requireRepoBinding } from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Scenario D — bring the connected branch's remote changes here. Refuses on
 * uncommitted changes rather than stashing them: a stash nobody asked for
 * is where work goes missing. Conflicts abort cleanly with `merge_conflict`.
 */
export async function gitPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cwd = process.cwd();
  const binding = requireRepoBinding(await readRepoBinding());
  requireGitRepository(await isGitRepository(cwd));

  const pending = await dirtyFiles(cwd);
  if (pending.length > 0) {
    throw new CliActionableError(
      `${pending.length} uncommitted change(s) would be overwritten by a pull.`,
      "working_tree_dirty",
      "Run 'blocks git push' to commit and push them first, or discard them with git, then pull again."
    );
  }

  const projectKey = await selectedProject(flags);
  const credential = await fetchPushCredential(projectKey, flags);
  const before = (await headSha(cwd)) ?? null;
  const rebase = booleanFlag(flags, "rebase");

  const pull = await git(["pull", "--no-edit", ...(rebase ? ["--rebase"] : ["--ff"]), "origin", binding.branch], { cwd, credential, identity: credential.login, timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  if (pull.code !== 0) {
    await git([rebase ? "rebase" : "merge", "--abort"], { cwd });
    const detail = (pull.stderr || pull.stdout).trim();
    const conflict = /CONFLICT|could not apply|Automatic merge failed/i.test(detail);
    throw new CliActionableError(
      conflict ? `Pulling ${binding.fullName}/${binding.branch} produced conflicts; the pull was aborted.` : `git pull failed: ${detail}`,
      conflict ? "merge_conflict" : "pull_failed",
      conflict ? "Resolve by hand with git, or reset to the remote with 'blocks git connect <owner/name> --strategy adopt-remote'." : undefined
    );
  }

  const after = (await headSha(cwd)) ?? null;
  writeOutput({ after, before, branch: binding.branch, changed: before !== after, pulled: true, repo: binding }, flags);
}
