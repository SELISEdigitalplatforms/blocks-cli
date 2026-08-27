import { blocksRequest } from "./api.js";
import { isRecord } from "./data-response.js";
import { requestContext } from "./request-context.js";

const RELOAD_API = "/data/v4/schema-configurations/reload";

/**
 * Reloads the project's Data Gateway, without the confirmation prompt `data reload`
 * asks for -- the caller already confirmed the mutation this reload completes.
 */
export async function reloadDataGateway(
  flags: Record<string, string | boolean>,
  projectTenantId: string
): Promise<unknown> {
  return blocksRequest<unknown>(RELOAD_API, {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId
  });
}

/**
 * Wraps a completed data-model mutation with the gateway reload it requires.
 *
 * Schema, rules, validation, and data-source writes are staged: the runtime gateway
 * keeps serving the previous configuration until it reloads, so a command that
 * returned success could leave the change invisible to the running app until some
 * later `data reload`. Every mutating data command routes its result through here so
 * the change is live by the time the command returns.
 *
 * The reload outcome is reported as `gatewayReload` beside the original response
 * rather than replacing it, so existing fields keep their shape.
 */
export async function withGatewayReload<T>(
  flags: Record<string, string | boolean>,
  projectTenantId: string,
  result: T
): Promise<Record<string, unknown>> {
  const gatewayReload = await reloadDataGateway(flags, projectTenantId);
  const base = isRecord(result) ? result : { result };
  return { ...base, gatewayReload };
}

/** SchemaAccessLevel: Inherited = 0, User = 1, Public = 2, Custom = 3. */
const ACCESS_LEVEL_PUBLIC = 2;

/** PolicyType.RLS = 0 -- row-level, i.e. the schema's own access level. */
const POLICY_TYPE_RLS = 0;

/**
 * PolicyOperation: READ = 0, WRITE = 1, EDIT = 2, DELETE = 3.
 *
 * Sent one operation at a time on purpose. The enum also has ALL = 4, but the
 * service's ConfigureSchemaAccess only branches on the four concrete operations and
 * silently does nothing for ALL, so a single "ALL" call would report success while
 * changing no access level at all.
 */
const POLICY_OPERATIONS = [0, 1, 2, 3] as const;

/** Pulls a newly created schema's id out of the response envelope. */
export function createdSchemaId(response: unknown): string | undefined {
  if (!isRecord(response)) return undefined;
  const data = isRecord(response.data) ? response.data : response;
  const itemId = data.itemId ?? data.id;
  return typeof itemId === "string" && itemId ? itemId : undefined;
}

/**
 * Grants a newly created schema Public access on all four operations.
 *
 * Neither schema-create endpoint accepts an access level -- `CreateSchemaRequest`
 * carries only CollectionName, SchemaName and SchemaType -- so a new schema always
 * lands on the SchemaDefinition entity default of User, which makes it unreadable to
 * anonymous callers. Applied at creation only: the update paths load the stored schema
 * and never touch its access levels, so a level the user changed later survives.
 */
export async function makeSchemaPublic(
  schemaId: string,
  projectTenantId: string,
  flags: Record<string, string | boolean>
): Promise<void> {
  for (const operation of POLICY_OPERATIONS) {
    await blocksRequest<unknown>("/data/v4/data-access/security/change", {
      body: {
        accessLevel: ACCESS_LEVEL_PUBLIC,
        fieldNames: [],
        operation,
        policyType: POLICY_TYPE_RLS,
        projectKey: projectTenantId,
        schemaId
      },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId
    });
  }
}
