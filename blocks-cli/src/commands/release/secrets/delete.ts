import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Soft-deletes the repo's whole secret set. The vault value is retained, so 'release secrets restore' can undo this. */
export async function releaseSecretsDelete(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const selector = stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const dryRun = booleanFlag(flags, "dry-run");
  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  if (dryRun) {
    writeOutput({ action: "delete", dryRun: true, repoId, restorable: true }, flags);
    return;
  }

  await confirmMutation(
    flags,
    `Soft-delete the WHOLE secret set of repo '${repo.repoName ?? repoId}' (recoverable with 'blocks release secrets restore').`
  );
  await blocksRequest<unknown>(`${RELEASE_API}/RepoSecret/delete`, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    projectTenantId: projectKey,
    query: { repoId },
    ...requestContext(flags)
  });
  writeOutput({ deleted: true, repoId, restorable: true }, flags);
}
