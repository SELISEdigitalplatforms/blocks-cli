import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersAccessRevoke(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userId = args[0] || stringFlag(flags, "user-id", { required: true });
  const body = { organizationId: stringFlag(flags, "organization-id") || undefined, userId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/users/revoke-access", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Revoke access for IAM user '${userId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/users/revoke-access", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
