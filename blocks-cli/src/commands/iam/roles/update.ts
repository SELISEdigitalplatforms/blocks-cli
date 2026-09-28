import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "item-id", { required: true });
  const projectKey = await selectedProject(flags);

  // POST /roles/update assigns Description and ParentRoleSlug straight from the request
  // (null when omitted) and CanCreateOwn is a non-nullable bool, so a rename used to
  // clear the description, detach the role from its parent and turn CanCreateOwn off.
  // Name is validated as required, which is the one field that never wiped silently.
  // Read the role and merge. PropagateToOtherOrg describes this call, not the role, so
  // it is deliberately not carried.
  const current = carryCurrent(
    await blocksRequest<unknown>(`/iam/v4/iam/roles/${encodeURIComponent(itemId)}`, {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }),
    ["name", "description", "parentRoleSlug", "canCreateOwn"]
  );

  const body = {
    ...current,
    ...(await jsonBodyFlag(flags)),
    ...compact({
      canCreateOwn: optionalBooleanFlag(flags, "can-create-own"),
      description: stringFlag(flags, "description") || undefined,
      itemId,
      name: stringFlag(flags, "name") || undefined,
      parentRoleSlug: stringFlag(flags, "parent-role-slug") || undefined,
      propagateToOtherOrg: optionalBooleanFlag(flags, "propagate-to-other-org")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/roles/update", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update IAM role '${itemId}'.`);
  const result = await blocksRequest<unknown>("/iam/v4/iam/roles/update", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
