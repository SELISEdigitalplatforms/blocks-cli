import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { getProjectAssets, resolveSelectedProject } from "../../../lib/project-info.js";
import { selectFromList } from "../../../lib/prompt.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand } from "../../../lib/workspace.js";

export async function releaseBuildsList(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const { group, tenantId: projectKey } = await resolveSelectedProject(flags);
  const repoId = args[0] || stringFlag(flags, "repo-id") || (await resolveRepoId(group.tenantGroupId, flags));

  const result = await blocksRequest<unknown>("/release/v4/api/Build/repo-details", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { RepoId: repoId }
  });
  writeOutput(result, flags);
}

async function resolveRepoId(tenantGroupId: string | undefined, flags: Record<string, string | boolean>): Promise<string> {
  if (!tenantGroupId) {
    throw new CliActionableError(
      "This project has no tenant group on record, so its linked repos can't be looked up.",
      "no_tenant_group",
      "Pass --repo-id explicitly."
    );
  }

  const response = await getProjectAssets(tenantGroupId, flags);
  const resources = response.assets?.resources ?? [];

  if (resources.length === 0) {
    throw new CliActionableError(
      "No repo linked to this project.",
      "repo_not_linked",
      "Link a repo from the Blocks portal (requires GitHub auth), then re-run this command, or pass --repo-id explicitly."
    );
  }

  const resource = resources.length === 1 ? resources[0] : resources[await selectFromList(
    "Multiple repos are linked to this project -- choose one:",
    resources.map((item) => `${item.name ?? "(unnamed)"} (${item.resourceId ?? "?"})`)
  )];

  if (!resource.resourceId) {
    throw new Error("The selected repo asset is missing a resourceId.");
  }

  return resource.resourceId;
}
