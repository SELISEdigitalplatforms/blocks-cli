import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "item-id", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      canCreateOwn: booleanFlag(flags, "can-create-own") || undefined,
      description: stringFlag(flags, "description") || undefined,
      itemId,
      name: stringFlag(flags, "name") || undefined,
      parentRoleSlug: stringFlag(flags, "parent-role-slug") || undefined,
      propagateToOtherOrg: booleanFlag(flags, "propagate-to-other-org") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/roles/update", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update IAM role '${itemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/roles/update", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
