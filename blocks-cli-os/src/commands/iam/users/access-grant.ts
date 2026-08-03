import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersAccessGrant(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userId = args[0] || stringFlag(flags, "user-id", { required: true });
  const body = {
    organizationId: stringFlag(flags, "organization-id") || undefined,
    permissions: listFlag(flags, "permissions"),
    roles: listFlag(flags, "roles"),
    userId
  };

  if (!body.roles && !body.permissions) throw new Error("Provide --roles and/or --permissions to grant.");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/users/access", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Grant access to IAM user '${userId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/users/access", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
