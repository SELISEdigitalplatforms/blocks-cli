import { basename } from "node:path";
import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import {
  GIT_DEFAULT_BRANCH, GIT_NETWORK_TIMEOUT_MS, commitAll, createRemoteRepository, currentBranch, ensureGitignore, expectOk,
  fetchPushCredential, git, hasCommits, headSha, initRepository, isGitRepository, pushUrlOf, readRepoBinding, repoFullNameOf,
  repoUrlOf, setRemote, writeRepoBinding
} from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Scenario A — the code exists here and nowhere else. Creates the GitHub
 * repository (unless --repo names an existing empty one), makes this
 * directory a git repository if it isn't, commits everything, pushes, and
 * records the binding in blocks.json. Idempotent about the local half: an
 * existing .git, commits, or .gitignore are kept, never recreated.
 *
 * Refuses when a repository is already connected: a second `init` would
 * quietly orphan the first. `blocks git disconnect` first is the explicit way.
 */
export async function gitInit(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cwd = process.cwd();
  const dryRun = booleanFlag(flags, "dry-run");
  const branch = stringFlag(flags, "branch", { defaultValue: GIT_DEFAULT_BRANCH });
  const existingRepo = stringFlag(flags, "repo") || undefined;
  const requestedName = stringFlag(flags, "name") || basename(cwd);
  const organization = stringFlag(flags, "org") || undefined;
  const description = stringFlag(flags, "description") || undefined;
  const isPrivate = !booleanFlag(flags, "public");
  const message = stringFlag(flags, "message", { defaultValue: "Initial commit from Blocks" });

  const already = await readRepoBinding();
  if (already) {
    throw new CliActionableError(
      `This workspace is already connected to ${already.fullName}.`,
      "repo_already_bound",
      "Use 'blocks git push' to push, or 'blocks git disconnect' first if you really want a different repository."
    );
  }

  const projectKey = await selectedProject(flags);
  const isRepo = await isGitRepository(cwd);
  const localBranch = isRepo ? await currentBranch(cwd) : undefined;
  const targetBranch = localBranch ?? branch;
  const target = existingRepo ? repoFullNameOf(existingRepo) : undefined;

  const plan = {
    branch: targetBranch,
    createRepository: target ? null : { name: requestedName, organization: organization ?? null, private: isPrivate },
    initializeGit: !isRepo,
    repository: target ?? `${organization ?? "<your account>"}/${requestedName}`,
    steps: [
      ...(isRepo ? [] : ["git init"]),
      "ensure .gitignore",
      "commit pending changes",
      ...(target ? [] : ["create GitHub repository"]),
      "set origin",
      `push ${targetBranch}`,
      "write repo binding to blocks.json"
    ]
  };
  if (dryRun) {
    writeOutput({ ...plan, dryRun: true }, flags);
    return;
  }

  await confirmMutation(
    flags,
    target
      ? `Push this directory to existing repository ${target} (branch ${targetBranch}) and connect it.`
      : `Create ${isPrivate ? "private" : "public"} GitHub repository '${requestedName}'${organization ? ` under ${organization}` : ""}, push this directory to it (branch ${targetBranch}) and connect it.`
  );

  // Credential first: if GitHub isn't connected, fail before touching disk.
  const credential = await fetchPushCredential(projectKey, flags);

  if (!isRepo) await initRepository(cwd, targetBranch);
  const ignored = await ensureGitignore(cwd);

  const repo = target
    ? { fullName: target, url: repoUrlOf(target) }
    : await createRemoteRepository({ name: requestedName, description, isPrivate, organization }, projectKey, flags);

  // The binding goes into blocks.json BEFORE the commit so it travels in the
  // same commit as the code: a clone then already knows its repository, and
  // this command leaves a clean tree instead of an uncommitted blocks.json
  // that the very next `blocks git pull` would refuse over.
  const binding = { branch: targetBranch, fullName: repo.fullName, provider: "github" as const, url: repo.url };
  await writeRepoBinding(binding);

  const commit = await commitAll(cwd, message, credential.login);
  if (!commit && !(await hasCommits(cwd))) {
    throw new CliActionableError("Nothing to push: this directory has no files.", "nothing_to_commit", "Add the app's files, then re-run 'blocks git init'.");
  }

  await setRemote(cwd, pushUrlOf(repo.fullName));
  const push = await git(["push", "-u", "origin", targetBranch], { cwd, credential, timeoutMs: GIT_NETWORK_TIMEOUT_MS });
  expectOk(push, `git push origin ${targetBranch}`, "push_rejected",
    target
      ? `The remote already has history. Use 'blocks git connect ${target} --strategy merge|keep-local|adopt-remote' instead of init.`
      : "Check the error above; the repository was created and the binding is saved, so 'blocks git push' retries it.");

  writeOutput({
    commit: commit ?? (await headSha(cwd)) ?? null,
    created: !target,
    gitignoreAdded: ignored,
    initializedGit: !isRepo,
    pushed: true,
    repo: binding
  }, flags);
}
