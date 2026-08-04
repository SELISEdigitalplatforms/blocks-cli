import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamOrganizationsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/iam/organizations", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      "Filter.Ids": listFlag(flags, "ids")?.join(","),
      "Filter.IsDisabled": optionalBooleanFlag(flags, "is-disabled"),
      "Filter.ParentOrganizationId": stringFlag(flags, "parent-organization-id") || undefined,
      "Filter.Search": stringFlag(flags, "search") || undefined,
      Page: integerFlag(flags, "page", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      "Sort.IsDescending": optionalBooleanFlag(flags, "sort-desc"),
      "Sort.Property": stringFlag(flags, "sort-by") || undefined
    }
  });
  writeOutput(result, flags);
}
