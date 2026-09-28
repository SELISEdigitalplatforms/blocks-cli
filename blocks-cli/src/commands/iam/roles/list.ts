import { booleanFlag, zeroBasedPage, integerFlag, stringFlag } from "../../../lib/args.js";
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
      // GetRolesFilter.Search is a non-nullable string server-side, so model
      // validation rejects the whole request when it is absent -- omitting it made
      // the default `iam roles list` fail with a bare 400. The repository treats
      // whitespace as "no filter" (`!string.IsNullOrWhiteSpace(Filter.Search)`),
      // so "" is the correct unfiltered value rather than a search for nothing.
      search: stringFlag(flags, "search") ?? "",
      slugs: listFlag(flags, "slugs")
    })
  };

  const body = {
    filter,
    organizationId: stringFlag(flags, "organization-id") || undefined,
    page: zeroBasedPage(flags),
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
