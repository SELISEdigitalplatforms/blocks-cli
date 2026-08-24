import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesAssignPermissions(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const slug = args[0] || stringFlag(flags, "slug", { required: true });
  const addPermissions = listFlag(flags, "add-permissions");
  const removePermissions = listFlag(flags, "remove-permissions");
  const organizationId = stringFlag(flags, "organization-id") || undefined;
  const body = {
    addPermissions,
    organizationId,
    removePermissions,
    slug
  };

  if (!body.addPermissions && !body.removePermissions) {
    throw new Error("Provide --add-permissions and/or --remove-permissions.");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/roles/assign-permissions", request: body }, flags);
    return;
  }

  const projectKey = await selectedProject(flags);
  const resolvedBody = {
    ...body,
    addPermissions: await resolvePermissionIdentifiers(addPermissions, organizationId, flags, projectKey),
    removePermissions: await resolvePermissionIdentifiers(removePermissions, organizationId, flags, projectKey)
  };

  await confirmMutation(flags, `Change permission assignments for IAM role '${slug}'.`);
  const result = await blocksRequest<unknown>("/iam/v4/iam/roles/assign-permissions", {
    body: resolvedBody,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

async function resolvePermissionIdentifiers(
  identifiers: string[] | undefined,
  organizationId: string | undefined,
  flags: Record<string, string | boolean>,
  projectKey: string
): Promise<string[] | undefined> {
  if (!identifiers?.length) return identifiers;

  const resources = identifiers.filter((item) => item.includes("::"));
  if (resources.length === 0) return identifiers;

  const response = await blocksRequest<unknown>("/iam/v4/iam/permissions", {
    body: {
      filter: {
        isArchived: false,
        resources
      },
      organizationId,
      page: 0,
      pageSize: Math.max(resources.length, 20)
    },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });

  const permissions = extractPermissionRows(response);
  const byResource = new Map<string, string>();
  for (const permission of permissions) {
    const resource = stringProperty(permission, "resource");
    const itemId = stringProperty(permission, "itemId") || stringProperty(permission, "_id") || stringProperty(permission, "id");
    if (resource && itemId) byResource.set(resource, itemId);
  }

  const missing = resources.filter((resource) => !byResource.has(resource));
  if (missing.length > 0) {
    throw new Error(`Could not resolve IAM permission resource(s) to itemId: ${missing.join(", ")}`);
  }

  return identifiers.map((identifier) => byResource.get(identifier) ?? identifier);
}

function extractPermissionRows(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];

  for (const key of ["data", "Data", "items", "Items", "permissions", "Permissions"]) {
    const value = response[key];
    if (Array.isArray(value)) return value.filter(isRecord);
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringProperty(record: Record<string, unknown>, name: string): string {
  const value = record[name] ?? record[name[0].toUpperCase() + name.slice(1)];
  return typeof value === "string" ? value : "";
}
