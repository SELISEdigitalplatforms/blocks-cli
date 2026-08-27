import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
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
      // booleanFlag, not stringFlag: a bare `--sort-desc` parses to boolean
      // true, which a string comparison silently reads as "not descending".
      // Every other list command in the CLI uses this helper for the flag.
      isDescending: booleanFlag(flags, "sort-desc"),
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
