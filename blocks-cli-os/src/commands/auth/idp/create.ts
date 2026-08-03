import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authIdpCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      clientId: stringFlag(flags, "client-id") || undefined,
      clientSecret: stringFlag(flags, "client-secret") || undefined,
      displayName: stringFlag(flags, "display-name") || undefined,
      isActive: booleanFlag(flags, "active") || undefined,
      issuer: stringFlag(flags, "issuer") || undefined,
      protocol: stringFlag(flags, "protocol") || undefined,
      provider: stringFlag(flags, "provider") || undefined,
      providerType: stringFlag(flags, "provider-type") || undefined,
      redirectUris: listFlag(flags, "redirect-uris"),
      scope: stringFlag(flags, "scope") || undefined
    })
  };

  if (!body.provider || !body.providerType || !body.protocol || !body.clientId) {
    throw new Error("Provide --provider, --provider-type, --protocol and --client-id (or set them in --body/--file).");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/identity-providers", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Create identity provider '${body.provider}' (${body.providerType}).`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/auth/identity-providers", {
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
