import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

// Roles, permissions and MFA state left POST /users/{id} for the endpoints that own
// them. The server binds them into UnmappedFields, logs a warning and returns 200
// having changed nothing -- so the CLI refuses them up front instead of letting a
// grant silently not happen. (ItemId/OrganizationId still bind; only these four are
// dead in a body.)
const RETIRED_UPDATE_FIELDS = ["roles", "permissions", "mfaEnabled", "userMfaType"];

export async function iamUsersUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  for (const flag of ["roles", "permissions"]) {
    if (flag in flags) {
      throw new CliActionableError(
        `--${flag} is no longer part of 'iam users update': the endpoint patches profile fields only and ignores it.`,
        "retired_update_field",
        `Use 'blocks iam users access grant ${id} --${flag} ...' instead -- note a non-empty list REPLACES that organization's list.`
      );
    }
  }

  // POST /users/{id} is a sparse patch: UpdateUserRequest binds every profile field as
  // nullable with no initializer, and the service applies only the non-null ones
  // (absent or null keeps the stored value, "" clears it). Send exactly the fields
  // being changed -- no read-and-merge round-trip, and the dry-run stays offline.
  // Clearing a text field therefore goes through --body ('{"lastName": ""}'), because
  // an empty convenience flag reads as "not passed".
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      // The route sets ItemId server-side; carried in the body too so the dry-run and
      // confirmation show the exact record being written.
      itemId: id,
      firstName: stringFlag(flags, "first-name") || undefined,
      lastName: stringFlag(flags, "last-name") || undefined,
      organizationId: stringFlag(flags, "organization-id") || undefined,
      phoneNumber: stringFlag(flags, "phone-number") || undefined
    })
  };

  const retired = RETIRED_UPDATE_FIELDS.filter((field) => field in body);
  if (retired.length > 0) {
    throw new CliActionableError(
      `The update-user endpoint ignores ${retired.join(", ")} -- it patches profile fields only, and the server would return 200 without applying them.`,
      "retired_update_field",
      `Move roles/permissions to 'blocks iam users access grant ${id}' and MFA state to the MFA commands, then re-run without them.`
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/iam/users/${encodeURIComponent(id)}`, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update IAM user '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/iam/users/${encodeURIComponent(id)}`, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
