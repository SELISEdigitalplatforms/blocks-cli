import { writeOutput } from "../../../lib/output.js";
import { listReleaseRepos, repoSummary } from "../../../lib/release.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Lists the repositories registered in blocks-release for the selected project. */
export async function releaseReposList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const repos = await listReleaseRepos(projectKey, flags);
  writeOutput({ repos: repos.map((repo) => repoSummary(repo)), totalCount: repos.length }, flags);
}
