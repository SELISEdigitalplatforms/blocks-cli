import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      firstName: stringFlag(flags, "first-name") || undefined,
      lastName: stringFlag(flags, "last-name") || undefined,
      organizationId: stringFlag(flags, "organization-id") || undefined,
      permissions: listFlag(flags, "permissions"),
      phoneNumber: stringFlag(flags, "phone-number") || undefined,
      roles: listFlag(flags, "roles")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/iam/users/${id}`, request: body }, flags);
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
