import { blocksRequest } from "./api.js";
import { isRecord } from "./data-response.js";
import { stringFlag } from "./args.js";
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
 *
 * A failing reload must NOT fail the command: the write it follows has already been
 * applied, and rethrowing here reported the whole mutation as failed. The caller's
 * natural response to that is to run the write again -- which for `data validation
 * save` came back as "Validation already exists for this schema field", and for
 * schema/rules writes re-sent a mutation that had already landed. The write is the
 * authoritative result, so the reload failure is reported in place, loudly, with the
 * command that finishes the job.
 */
export async function withGatewayReload<T>(
  flags: Record<string, string | boolean>,
  projectTenantId: string,
  result: T
): Promise<Record<string, unknown>> {
  const base = isRecord(result) ? result : { result };

  try {
    return { ...base, gatewayReload: await reloadDataGateway(flags, projectTenantId) };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    // stderr, so a --json document on stdout stays one parseable object.
    console.error(
      `Warning: the write succeeded but the Data Gateway reload failed (${detail}). `
      + "The change is stored and staged, and goes live once a reload succeeds. "
      + "Run 'blocks data reload --yes' -- do not re-run the write, it has already been applied."
    );
    return {
      ...base,
      gatewayReload: { error: detail, nextStep: "blocks data reload --yes", ok: false, writeApplied: true }
    };
  }
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

/** Access a schema gets when `data schema push` / `data schema info save` creates it. */
export type NewSchemaAccess = "user" | "public";

/**
 * Reads `--access user|public` for the schema-create paths. Defaults to `user`: the
 * server's own default, where only signed-in users can read or write. The CLI used to
 * grant Public on every create without saying so in help or the skill, which left
 * every new collection open to anonymous reads and writes until a later
 * `data rules deploy` -- so Public is now an explicit opt-in.
 */
export function newSchemaAccessFlag(flags: Record<string, string | boolean>): NewSchemaAccess {
  const raw = stringFlag(flags, "access").trim().toLowerCase();
  if (!raw || raw === "user") return "user";
  if (raw === "public") return "public";
  throw new Error(
    `--access must be 'user' or 'public' (got '${stringFlag(flags, "access")}'). `
    + "For Custom access, deploy security entries and policies with 'data rules deploy'."
  );
}

/**
 * Applies the requested access to a schema that was just created.
 *
 * Neither schema-create endpoint accepts an access level -- `CreateSchemaRequest`
 * carries only CollectionName, SchemaName and SchemaType -- so a new schema always
 * lands on the SchemaDefinition entity default of User. `user` therefore sends
 * nothing; `public` grants Public on all four operations. Applied at creation only:
 * the update paths load the stored schema and never touch its access levels, so a
 * level the user changed later survives.
 */
export async function applyNewSchemaAccess(
  schemaId: string,
  projectTenantId: string,
  flags: Record<string, string | boolean>,
  access: NewSchemaAccess
): Promise<void> {
  if (access === "public") await makeSchemaPublic(schemaId, projectTenantId, flags);
}

/** Grants a schema Public access on all four operations. */
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
