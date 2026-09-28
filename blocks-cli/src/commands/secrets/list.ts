import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, SECRET_STATUSES, requireOneOf } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** Paged secret METADATA (Secrets/gets with SecretFilter). Never returns values. */
export async function secretsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const status = stringFlag(flags, "status");
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  const pageSize = integerFlag(flags, "page-size", 20);
  if (pageSize < 1) throw new Error("--page-size must be greater than or equal to 1");

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/gets`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: {
      IncludeDeleted: booleanFlag(flags, "include-deleted") || undefined,
      OrganizationId: stringFlag(flags, "organization-id") || undefined,
      PageNumber: page,
      PageSize: pageSize,
      Search: stringFlag(flags, "search") || undefined,
      Status: status ? requireOneOf(status, SECRET_STATUSES, "status", "invalid_secret_status") : undefined
    },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
