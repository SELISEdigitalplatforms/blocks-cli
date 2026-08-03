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
  const body = {
    addPermissions: listFlag(flags, "add-permissions"),
    oragnizationId: stringFlag(flags, "organization-id") || undefined,
    removePermissions: listFlag(flags, "remove-permissions"),
    slug
  };

  if (!body.addPermissions && !body.removePermissions) {
    throw new Error("Provide --add-permissions and/or --remove-permissions.");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/roles/assign-permissions", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Change permission assignments for IAM role '${slug}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/roles/assign-permissions", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
