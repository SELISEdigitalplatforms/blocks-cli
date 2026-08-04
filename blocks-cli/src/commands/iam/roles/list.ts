import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const filter = {
    ...(await jsonBodyFlag(flags)).filter as Record<string, unknown> | undefined,
    ...compact({
      search: stringFlag(flags, "search") || undefined,
      slugs: listFlag(flags, "slugs")
    })
  };

  const body = {
    filter,
    organizationId: stringFlag(flags, "organization-id") || undefined,
    page: integerFlag(flags, "page", 1),
    pageSize: integerFlag(flags, "page-size", 20),
    sort: {
      isDescending: stringFlag(flags, "sort-desc") === "true",
      property: stringFlag(flags, "sort-by") || undefined
    }
  };

  const result = await blocksRequest<unknown>("/iam/v4/iam/roles", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
