import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import {
  GIT_DEFAULT_BRANCH, GIT_NETWORK_TIMEOUT_MS, commitAll, currentBranch, dirtyFiles, ensureGitignore, expectOk, fetchPushCredential, git,
  hasCommits, headSha, isGitRepository, pushUrlOf, readRepoBinding, repoFullNameOf, repoUrlOf, requireGitRepository, setRemote, writeRepoBinding
} from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const STRATEGIES = ["keep-local", "adopt-remote", "merge"] as const;
type Strategy = (typeof STRATEGIES)[number];

/**
 * Scenario C — the code exists both here and on GitHub, and the two were
 * never connected. This is the one case where every outcome destroys
 * something, so the strategy is a required flag and is never inferred:
 *
 *   keep-local    the remote branch becomes what is here (force-with-lease).
 *   adopt-remote  this directory becomes what the remote has; local commits
 *                 not on the remote are lost, uncommitted changes are lost.
 *   merge         unrelated histories are merged, then pushed; conflicts stop
 *                 the command with `merge_conflict` and nothing is pushed.
 */
export async function gitConnect(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const cwd = process.cwd();
  const fullName = repoFullNameOf(args[0] || stringFlag(flags, "repo", { required: true }));
  const strategyFlag = stringFlag(flags, "strategy") || undefined;
  const dryRun = booleanFlag(flags, "dry-run");

  if (!strategyFlag) {
    throw new CliActionableError(
      "Connecting an existing directory to an existing repository needs an explicit --strategy.",
      "strategy_required",
      `Re-run with --strategy ${STRATEGIES.join("|")}: keep-local overwrites the remote branch with this directory, adopt-remote overwrites this directory with the remote branch, merge joins the two histories.`
    );
  }
  if (!(STRATEGIES as readonly string[]).includes(strategyFlag)) {
    throw new CliActionableError(`'${strategyFlag}' is not a strategy.`, "invalid_strategy", `Use one of ${STRATEGIES.join(", ")}.`);
  }
  const strategy = strategyFlag as Strategy;

  const already = await readRepoBinding();
  if (already && already.fullName !== fullName) {
    throw new CliActionableError(
      `This workspace is already connected to ${already.fullName}.`,
      "repo_already_bound",
      "Run 'blocks git disconnect' first if you want to connect a different repository."
    );
  }

  requireGitRepository(await isGitRepository(cwd));
  const branch = stringFlag(flags, "branch") || (await currentBranch(cwd)) || GIT_DEFAULT_BRANCH;
  const pending = await dirtyFiles(cwd);

  const plan = {
    branch,
    repository: fullName,
    strategy,
    uncommittedFiles: pending.length,
    willDiscardLocalChanges: strategy === "adopt-remote",
    willOverwriteRemoteBranch: strategy === "keep-local"
  };
  if (dryRun) {
    writeOutput({ ...plan, dryRun: true }, flags);
    return;
  }

  const warning = strategy === "keep-local"
    ? `Overwrite branch '${branch}' on ${fullName} with this directory's history. Commits that exist only on the remote will be lost.`
    : strategy === "adopt-remote"
      ? `Replace this directory's '${branch}' with ${fullName}'s. Local commits not on the remote${pending.length ? ` and ${pending.length} uncommitted file(s)` : ""} will be lost.`
      : `Merge ${fullName}'s '${branch}' into this directory's history and push the result.`;
  await confirmMutation(flags, warning);

  const projectKey = await selectedProject(flags);
  const credential = await fetchPushCredential(projectKey, flags);
  await setRemote(cwd, pushUrlOf(fullName));

  const binding = { branch, fullName, provider: "github" as const, url: repoUrlOf(fullName) };
  const bindMessage = `Connect ${fullName} from Blocks`;

  // Whatever the strategy, the command ends with the binding committed and
  // the tree clean -- see `git init` for why the binding is committed rather
  // than left as an uncommitted blocks.json.
  if (strategy === "keep-local") {
    // Fetch first so --force-with-lease has a remote-tracking ref to lease
    // against: "overwrite the remote as I just saw it", never blindly. A
    // remote branch that doesn't exist yet needs no force at all.
    const fetched = (await git(["fetch", "origin", branch], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS })).code === 0;
    await ensureGitignore(cwd);
    await writeRepoBinding(binding);
    await commitAll(cwd, stringFlag(flags, "message", { defaultValue: bindMessage }), credential.login);
    if (!(await hasCommits(cwd))) throw new CliActionableError("Nothing to push: this directory has no files.", "nothing_to_commit", "Add the app's files first.");
    const pushArgs = fetched ? ["push", "--force-with-lease", "-u", "origin", `${branch}:${branch}`] : ["push", "-u", "origin", branch];
    expectOk(await git(pushArgs, { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS }),
      "git push --force-with-lease", "push_rejected", "The remote moved while this ran. Re-run to retry against its current state.");
  } else {
    expectOk(await git(["fetch", "origin", branch], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS }), `git fetch origin ${branch}`, "fetch_failed",
      `Check that ${fullName} has a branch named '${branch}', or pass --branch.`);

    if (strategy === "adopt-remote") {
      expectOk(await git(["checkout", "-q", "-B", branch, `origin/${branch}`], { cwd }), `git checkout -B ${branch} origin/${branch}`);
      expectOk(await git(["reset", "-q", "--hard", `origin/${branch}`], { cwd }), "git reset --hard");
      expectOk(await git(["clean", "-fdq", "-e", "node_modules", "-e", ".env"], { cwd }), "git clean");
    } else {
      await ensureGitignore(cwd);
      await commitAll(cwd, stringFlag(flags, "message", { defaultValue: bindMessage }), credential.login);
      if (await hasCommits(cwd)) {
        const merge = await git(["merge", "--allow-unrelated-histories", "--no-edit", `origin/${branch}`], { cwd, identity: credential.login });
        if (merge.code !== 0) {
          await git(["merge", "--abort"], { cwd });
          throw new CliActionableError(
            `Merging ${fullName}/${branch} produced conflicts; the merge was aborted and nothing was pushed.`,
            "merge_conflict",
            "Resolve by choosing a side: --strategy keep-local or --strategy adopt-remote, or merge by hand with git and then 'blocks git push'."
          );
        }
      } else {
        expectOk(await git(["checkout", "-q", "-B", branch, `origin/${branch}`], { cwd }), `git checkout -B ${branch}`);
      }
    }

    // Binding on top of whichever history won; a no-op commit when the remote
    // already carried this exact binding (a repo created by `blocks git init`).
    await ensureGitignore(cwd);
    await writeRepoBinding(binding);
    await commitAll(cwd, bindMessage, credential.login);
    expectOk(await git(["push", "-u", "origin", branch], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS }), `git push origin ${branch}`, "push_rejected");
  }

  writeOutput({ commit: (await headSha(cwd)) ?? null, connected: true, repo: binding, strategy }, flags);
}
