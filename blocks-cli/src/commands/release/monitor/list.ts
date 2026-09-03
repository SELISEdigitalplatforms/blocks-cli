import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Monitoring/alerting entries for one deployed repo. */
export async function releaseMonitorList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const selector = stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  const result = await blocksRequest<unknown>(`${RELEASE_API}/Monitor/GetMonitorListByRepoId`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { ProjectKey: projectKey, repoId },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
