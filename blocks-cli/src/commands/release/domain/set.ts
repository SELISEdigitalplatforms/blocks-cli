import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { resolveSelectedProject } from "../../../lib/project-info.js";
import { RELEASE_API, repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand } from "../../../lib/workspace.js";

/** Sets a repo's custom deployment domain (Build/repo-update), separate from deploying. */
export async function releaseDomainSet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const domain = args[0] || stringFlag(flags, "domain", { required: true });
  const selector = stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const dryRun = booleanFlag(flags, "dry-run");

  const { project, tenantId: projectKey } = await resolveSelectedProject(flags);
  const environment = project.environment;
  if (!environment) throw new Error(`Project '${projectKey}' has no environment in Project/Gets.`);

  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  if (dryRun) {
    writeOutput({ domain, dryRun: true, environment, projectKey, repoId }, flags);
    return;
  }

  await confirmMutation(
    flags,
    `Set custom domain '${domain}' on repo '${repo.repoName ?? repoId}' (environment '${environment}').`
  );

  const result = await blocksRequest<unknown>(`${RELEASE_API}/Build/repo-update`, {
    body: {
      projectEnv: environment,
      repoWithDomains: [{ customDeploymentDomain: domain, repoId, repoUrl: repo.repoUrl ?? "" }]
    },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
