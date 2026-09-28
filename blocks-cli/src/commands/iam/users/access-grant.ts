import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersAccessGrant(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userId = args[0] || stringFlag(flags, "user-id", { required: true });
  const addPermissions = listFlag(flags, "permissions");
  const roles = listFlag(flags, "roles");
  const organizationId = stringFlag(flags, "organization-id") || undefined;
  const body = {
    organizationId,
    permissions: addPermissions,
    roles,
    userId
  };

  if (!body.roles && !body.permissions) throw new Error("Provide --roles and/or --permissions to grant.");

  const projectKey = await selectedProject(flags);

  // /users/access keeps the stored list when one is omitted or empty, but a non-empty
  // --roles or --permissions REPLACES that organization's whole list rather than adding
  // to it -- `--roles editor` on a user who is also `admin` leaves them with editor only.
  // Read the current lists (the GET flattens them for the same organization the grant
  // resolves) so a grant that would drop something is visible before it is confirmed.
  const current = carryCurrent(
    await blocksRequest<unknown>(`/iam/v4/iam/users/${encodeURIComponent(userId)}`, {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { organizationId }
    }),
    ["roles", "permissions"]
  );
  const currentRoles = Array.isArray(current.roles) ? current.roles : [];
  const currentPermissions = Array.isArray(current.permissions) ? current.permissions : [];

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        current: { permissions: currentPermissions, roles: currentRoles },
        dryRun: true,
        endpoint: "/iam/v4/iam/users/access",
        replaces:
          "a non-empty roles/permissions list replaces the organization's current list; an omitted one is kept for an existing member and starts empty when this grant first adds the organization",
        request: body
      },
      flags
    );
    return;
  }

  const summary = [
    roles ? `roles ${JSON.stringify(currentRoles)} -> ${JSON.stringify(roles)}` : undefined,
    addPermissions ? `permissions ${JSON.stringify(currentPermissions)} -> ${JSON.stringify(addPermissions)}` : undefined
  ].filter(Boolean).join("; ");
  await confirmMutation(flags, `Set access for IAM user '${userId}' (replaces the listed sets): ${summary}.`);
  const result = await blocksRequest<unknown>("/iam/v4/iam/users/access", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
