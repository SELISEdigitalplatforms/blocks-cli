import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamOrganizationsCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      defaultPermissionsForMembers: listFlag(flags, "default-permissions"),
      defaultRoleForMembers: listFlag(flags, "default-roles"),
      description: stringFlag(flags, "description") || undefined,
      email: stringFlag(flags, "email") || undefined,
      name: stringFlag(flags, "name") || undefined,
      phoneNumber: stringFlag(flags, "phone-number") || undefined,
      websiteUrl: stringFlag(flags, "website-url") || undefined
    })
  };

  if (!body.name) throw new Error("Provide --name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/organizations/create", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create IAM organization '${body.name}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/organizations/create", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
