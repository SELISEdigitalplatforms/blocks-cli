import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authClientCredentialsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessTokenValidForNumberMinutes: optionalIntegerFlag(flags, "access-token-valid-minutes"),
      isActive: optionalBooleanFlag(flags, "active"),
      itemId: stringFlag(flags, "item-id") || undefined,
      name: stringFlag(flags, "name") || undefined,
      permissions: listFlag(flags, "permissions"),
      roles: listFlag(flags, "roles")
    })
  };

  if (!body.name && !body.itemId) throw new Error("Provide --name (create) or --item-id (update), or set them in --body/--file.");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/client-credentials", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save client credential '${body.name ?? body.itemId}'. The response's clientSecret is shown once.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/auth/client-credentials", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function redactSecret(body: Record<string, unknown>): Record<string, unknown> {
  if (!body.clientSecret) return body;
  return { ...body, clientSecret: "***" };
}
