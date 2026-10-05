import { join } from "node:path";
import { booleanFlag } from "../../lib/args.js";
import { CliActionableError } from "../../lib/errors.js";
import { GIT_NETWORK_TIMEOUT_MS, dirtyFiles, fetchPushCredential, git, headSha, isGitRepository, pathExists, readRepoBinding, requireGitRepository, requireRepoBinding } from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Scenario D — bring the connected branch's remote changes here. Refuses on
 * uncommitted changes rather than stashing them: a stash nobody asked for
 * is where work goes missing. Conflicts abort cleanly with `merge_conflict`,
 * whose `details.conflictedFiles` names the files both sides changed.
 *
 * `--keep-conflicts` (merge only) stops with the conflict left in place
 * instead, for a caller that resolves it itself and then runs
 * `blocks git push`, which commits the merge. `--abort` gives up on such a
 * merge and puts the workspace back exactly as it was before the pull.
 */
export async function gitPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cwd = process.cwd();
  const binding = requireRepoBinding(await readRepoBinding());
  requireGitRepository(await isGitRepository(cwd));

  // Before the dirty check: a merge left in place is, by definition, a dirty tree.
  if (booleanFlag(flags, "abort")) {
    const inProgress = await pathExists(join(cwd, ".git", "MERGE_HEAD"));
    if (inProgress) {
      const abort = await git(["merge", "--abort"], { cwd });
      if (abort.code !== 0) {
        throw new CliActionableError(`git merge --abort failed: ${(abort.stderr || abort.stdout).trim()}`, "abort_failed");
      }
    }
    writeOutput({ aborted: inProgress, branch: binding.branch, repo: binding }, flags);
    return;
  }

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
  const keepConflicts = booleanFlag(flags, "keep-conflicts");
  if (rebase && keepConflicts) {
    throw new CliActionableError("--keep-conflicts works with a merge, not --rebase.", "invalid_flags", "Drop one of the two flags.");
  }

  const pull = await git(["pull", "--no-edit", ...(rebase ? ["--rebase"] : ["--ff"]), "origin", binding.branch], { cwd, credential, identity: credential.login, timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  if (pull.code !== 0) {
    const detail = (pull.stderr || pull.stdout).trim();
    // Both streams: git reports the fetch ("From …") on stderr but the
    // CONFLICT lines on stdout, so testing one alone misreads a conflict.
    const conflict = /CONFLICT|could not apply|Automatic merge failed/i.test(`${pull.stdout}\n${pull.stderr}`);
    const conflictedFiles = conflict ? await unmergedFiles(cwd) : [];

    if (conflict && keepConflicts) {
      throw new CliActionableError(
        `Pulling ${binding.fullName}/${binding.branch} produced conflicts; they were left in place to resolve.`,
        "merge_conflict",
        "Resolve every conflicted file, then run 'blocks git push' to commit the merge — or 'blocks git pull --abort' to give up on it.",
        { conflictedFiles, kept: true }
      );
    }

    await git([rebase ? "rebase" : "merge", "--abort"], { cwd });
    throw new CliActionableError(
      conflict ? `Pulling ${binding.fullName}/${binding.branch} produced conflicts; the pull was aborted.` : `git pull failed: ${detail}`,
      conflict ? "merge_conflict" : "pull_failed",
      conflict ? "Resolve by hand with git, or reset to the remote with 'blocks git connect <owner/name> --strategy adopt-remote'." : undefined,
      conflict ? { conflictedFiles, kept: false } : undefined
    );
  }

  const after = (await headSha(cwd)) ?? null;
  writeOutput({ after, before, branch: binding.branch, changed: before !== after, pulled: true, repo: binding }, flags);
}

/** Files git could not merge on its own — both sides changed the same lines. */
async function unmergedFiles(cwd: string): Promise<string[]> {
  const result = await git(["diff", "--name-only", "--diff-filter=U"], { cwd });
  return result.code === 0 ? result.stdout.split("\n").map((line) => line.trim()).filter(Boolean) : [];
}
