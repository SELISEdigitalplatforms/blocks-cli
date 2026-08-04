import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamPermissionsCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      dependentPermissions: listFlag(flags, "dependent-permissions"),
      description: stringFlag(flags, "description") || undefined,
      isBuiltIn: optionalBooleanFlag(flags, "is-built-in"),
      name: stringFlag(flags, "name") || undefined,
      permissionSeverity: optionalIntegerFlag(flags, "severity"),
      resource: stringFlag(flags, "resource") || undefined,
      resourceGroup: stringFlag(flags, "resource-group") || undefined,
      tags: listFlag(flags, "tags"),
      type: optionalIntegerFlag(flags, "type")
    })
  };

  if (!body.name) throw new Error("Provide --name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/permissions/create", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create IAM permission '${body.name}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/permissions/create", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
