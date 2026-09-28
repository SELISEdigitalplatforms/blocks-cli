import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { writeOutput } from "../../lib/output.js";
import { RELEASE_API, repoIdOf, repoSummary, resolveRepoBySelector } from "../../lib/release.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Deletes a repo's live deployment: the server cancels any in-flight build and deletes
 * the Kubernetes namespace. Destructive and not undoable, so the repo is always named
 * EXPLICITLY -- there is deliberately no fall-back to "the only repo" here -- and the
 * confirmation spells out the namespace and URL being destroyed.
 */
export async function releaseTeardown(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const selector = args[0] || stringFlag(flags, "repo-id") || stringFlag(flags, "repo");
  if (!selector) {
    throw new CliActionableError(
      "release teardown requires the repo to tear down, named explicitly.",
      "repo_selector_required",
      "Run 'blocks release repos list', then re-run as 'blocks release teardown <repoName|repoId>'."
    );
  }
  const dryRun = booleanFlag(flags, "dry-run");

  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoBySelector(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  const summary = repoSummary(repo);

  if (dryRun) {
    writeOutput({ action: "teardown", dryRun: true, target: summary }, flags);
    return;
  }

  const namespace = repo.deployedNamespace ? `namespace '${repo.deployedNamespace}'` : "no recorded namespace";
  const url = summary.url ? `, serving '${summary.url as string}'` : "";
  await confirmMutation(
    flags,
    `TEAR DOWN the deployment of repo '${repo.repoName ?? repoId}' (${namespace}${url}). This cancels in-flight builds and deletes the Kubernetes namespace. It cannot be undone.`
  );

  const result = await blocksRequest<unknown>(`${RELEASE_API}/Build/deployment`, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    projectTenantId: projectKey,
    query: { repoId },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
