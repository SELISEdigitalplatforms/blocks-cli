import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const filter = {
    ...(await jsonBodyFlag(flags)).filter as Record<string, unknown> | undefined,
    ...compact({
      email: stringFlag(flags, "email") || undefined,
      name: stringFlag(flags, "name") || undefined,
      organizationId: stringFlag(flags, "organization-id") || undefined
    })
  };

  const body = {
    page: integerFlag(flags, "page", 1),
    pageSize: integerFlag(flags, "page-size", 20),
    sort: {
      isDescending: stringFlag(flags, "sort-desc") === "true",
      property: stringFlag(flags, "sort-by") || undefined
    },
    filter
  };

  const result = await blocksRequest<unknown>("/iam/v4/iam/users", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
