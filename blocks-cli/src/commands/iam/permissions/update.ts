import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { isRecord } from "../../../lib/data-response.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamPermissionsUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "id", { required: true });
  const projectKey = await selectedProject(flags);

  // UpdatePermissionRequest extends PermissionRequestBase, whose Name, Resource and
  // ResourceGroup are non-nullable -- the endpoint replaces the whole document rather
  // than patching it, so a description-only edit was rejected for the three fields it
  // never meant to change. Read the current permission first and merge over it, the
  // same shape `auth oidc-clients save` uses for its own full-replace endpoint.
  // (IsBuiltIn and IsArchived are deliberately ignored server-side on update, so
  // carrying them over is harmless.)
  const current = await readCurrentPermission(itemId, projectKey, flags);

  const overrides = compact({
      dependentPermissions: listFlag(flags, "dependent-permissions"),
      description: stringFlag(flags, "description") || undefined,
      isArchived: optionalBooleanFlag(flags, "is-archived"),
      isBuiltIn: optionalBooleanFlag(flags, "is-built-in"),
      itemId,
      name: stringFlag(flags, "name") || undefined,
      permissionSeverity: optionalIntegerFlag(flags, "severity"),
      resource: stringFlag(flags, "resource") || undefined,
      resourceGroup: stringFlag(flags, "resource-group") || undefined,
      tags: listFlag(flags, "tags"),
      type: optionalIntegerFlag(flags, "type")
  });

  const body = { ...current, ...(await jsonBodyFlag(flags)), ...overrides, itemId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/iam/permissions/${encodeURIComponent(itemId)}`, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update IAM permission '${itemId}'.`);
  const result = await blocksRequest<unknown>(`/iam/v4/iam/permissions/${encodeURIComponent(itemId)}`, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

/**
 * Fetches the permission's current document and keeps only the fields
 * `PermissionRequestBase` declares, so the merged body carries every required field
 * without also echoing read-only metadata (createdDate, roles, archive counts) back
 * at the API.
 */
async function readCurrentPermission(
  itemId: string,
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<Record<string, unknown>> {
  const response = await blocksRequest<unknown>(`/iam/v4/iam/permissions/${encodeURIComponent(itemId)}`, {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });

  const envelope = isRecord(response) ? response : {};
  const permission = isRecord(envelope.data) ? envelope.data : envelope;

  const carried = [
    "dependentPermissions",
    "description",
    "name",
    "permissionSeverity",
    "resource",
    "resourceGroup",
    "tags",
    "type"
  ] as const;

  const current: Record<string, unknown> = {};
  for (const key of carried) {
    if (permission[key] !== undefined && permission[key] !== null) current[key] = permission[key];
  }
  return current;
}
