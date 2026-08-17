import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const sortBy = stringFlag(flags, "sort-by");

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
    page: iamBackendPage(flags),
    pageSize: integerFlag(flags, "page-size", 20),
    sort: sortBy ? {
      isDescending: booleanFlag(flags, "sort-desc"),
      property: sortBy
    } : undefined
  };

  const result = await blocksRequest<unknown>("/iam/v4/iam/roles", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function iamBackendPage(flags: Record<string, string | boolean>): number {
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  return page - 1;
}
