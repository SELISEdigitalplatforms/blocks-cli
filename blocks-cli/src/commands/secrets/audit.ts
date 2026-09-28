import { integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Paged audit trail (Secrets/audit with SecretAuditFilter): every Set, GetValue, Rotate,
 * Lock, Delete, UpdateAccess, AccessDenied... with actor, outcome and reason. Filter by
 * secret (positional or --secret-id), --action, --actor-user-id, --from/--to (ISO dates).
 */
export async function secretsAudit(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  const pageSize = integerFlag(flags, "page-size", 20);
  if (pageSize < 1) throw new Error("--page-size must be greater than or equal to 1");

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/audit`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: {
      Action: stringFlag(flags, "action") || undefined,
      ActorUserId: stringFlag(flags, "actor-user-id") || undefined,
      FromDate: stringFlag(flags, "from") || undefined,
      PageNumber: page,
      PageSize: pageSize,
      SecretId: args[0] || stringFlag(flags, "secret-id") || undefined,
      ToDate: stringFlag(flags, "to") || undefined
    },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
