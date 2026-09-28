import { writeOutput } from "../../lib/output.js";
import { aheadBehind, currentBranch, dirtyFiles, hasCommits, headSha, isGitRepository, readRepoBinding, remoteUrl } from "../../lib/git.js";
import { parseCommand } from "../../lib/workspace.js";

/**
 * Where this workspace stands against its connected repository. Read-only and
 * local: it never fetches, so `behind` reflects the last fetch/pull, not the
 * remote right now. Exit 0 even when nothing is connected — the JSON says so
 * (`bound: null`, `isRepository: false`) and a caller like Studio branches on
 * that rather than on an error.
 */
export async function gitStatus(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cwd = process.cwd();
  const bound = (await readRepoBinding()) ?? null;
  const isRepository = await isGitRepository(cwd);

  if (!isRepository) {
    writeOutput({ ahead: 0, behind: 0, bound, branch: null, commit: null, dirtyFiles: [], isRepository: false, remote: null, upstream: null }, flags);
    return;
  }

  const branch = (await currentBranch(cwd)) ?? null;
  const commit = (await hasCommits(cwd)) ? (await headSha(cwd)) ?? null : null;
  const remote = (await remoteUrl(cwd)) ?? null;
  const counts = branch ? await aheadBehind(cwd, branch) : undefined;

  writeOutput({
    ahead: counts?.ahead ?? 0,
    behind: counts?.behind ?? 0,
    bound,
    branch,
    commit,
    dirtyFiles: await dirtyFiles(cwd),
    isRepository: true,
    remote,
    upstream: counts && branch ? `origin/${branch}` : null
  }, flags);
}
