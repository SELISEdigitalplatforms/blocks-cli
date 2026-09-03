import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function releaseSecretsLock(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const selector = stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const dryRun = booleanFlag(flags, "dry-run");
  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  if (dryRun) {
    writeOutput({ action: "lock", dryRun: true, repoId }, flags);
    return;
  }

  await confirmMutation(flags, `Lock the secret set of repo '${repo.repoName ?? repoId}'.`);
  await blocksRequest<unknown>(`${RELEASE_API}/RepoSecret/lock`, {
    body: { repoId },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput({ locked: true, repoId }, flags);
}
