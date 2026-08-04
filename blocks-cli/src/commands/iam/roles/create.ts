import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamRolesCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      canCreateOwn: booleanFlag(flags, "can-create-own") || undefined,
      description: stringFlag(flags, "description") || undefined,
      name: stringFlag(flags, "name") || undefined,
      parentRoleSlug: stringFlag(flags, "parent-role-slug") || undefined,
      slug: stringFlag(flags, "slug") || undefined
    })
  };

  if (!body.name) throw new Error("Provide --name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/roles/create", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create IAM role '${body.name}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/roles/create", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
