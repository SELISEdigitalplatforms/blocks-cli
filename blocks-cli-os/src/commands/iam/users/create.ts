import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      email: stringFlag(flags, "email") || undefined,
      firstName: stringFlag(flags, "first-name") || undefined,
      lastName: stringFlag(flags, "last-name") || undefined,
      organizationId: stringFlag(flags, "organization-id") || undefined,
      password: stringFlag(flags, "password") || undefined,
      permissions: listFlag(flags, "permissions"),
      phoneNumber: stringFlag(flags, "phone-number") || undefined,
      roles: listFlag(flags, "roles"),
      userName: stringFlag(flags, "user-name") || undefined
    })
  };

  if (!body.email && !body.userName) throw new Error("Provide --email or --user-name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/users/create", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create IAM user '${body.email ?? body.userName}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/users/create", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
