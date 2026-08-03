import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Provider, providerType, protocol and clientId are immutable on this endpoint --
 * IAM requires them to echo the existing value when supplied, so only pass them
 * via --provider/--provider-type/--protocol/--client-id if you're re-sending the
 * current configuration alongside other field changes.
 */
export async function authIdpUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      clientId: stringFlag(flags, "client-id") || undefined,
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

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/auth/identity-providers/${id}`, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update identity provider '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/auth/identity-providers/${encodeURIComponent(id)}`, {
    body,
    impersonatedProjectAuth: true,
    method: "PUT",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
