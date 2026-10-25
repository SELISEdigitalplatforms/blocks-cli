import { booleanFlag, zeroBasedPage, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const bodyFilter = { ...((await jsonBodyFlag(flags)).filter as Record<string, unknown> | undefined) };
  // IAM's GetUsersFilter binds `organizationIds` (a list); the singular `organizationId`
  // this command used to send matched nothing, so every user came back. A --body filter
  // written with the singular name is translated too.
  const legacyOrganizationId = typeof bodyFilter.organizationId === "string" ? [bodyFilter.organizationId] : undefined;
  delete bodyFilter.organizationId;
  const filter = {
    ...bodyFilter,
    ...compact({
      email: stringFlag(flags, "email") || undefined,
      name: stringFlag(flags, "name") || undefined,
      organizationIds: listFlag(flags, "organization-id") ?? legacyOrganizationId
    })
  };

  const body = {
    page: zeroBasedPage(flags),
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
