import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
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
 *
 * This is also the only endpoint that can set the OIDC endpoint URLs: the create
 * endpoint silently drops authorizationUrl/tokenUrl/userInfoUrl, and a provider
 * auto-registered from an OIDC client (--register-as-identity-provider) never has
 * them. `GET /iam/v4/idp/initiate` needs authorizationUrl, so a freshly created
 * provider has to be patched here before hosted login works. Apple-only fields
 * stay in --body/--file so no private key lands in shell history.
 */
export async function authIdpUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      authorizationUrl: stringFlag(flags, "authorization-url") || undefined,
      clientId: stringFlag(flags, "client-id") || undefined,
      displayName: stringFlag(flags, "display-name") || undefined,
      grantTypes: listFlag(flags, "grant-types"),
      icon: stringFlag(flags, "icon") || undefined,
      initialPermissions: listFlag(flags, "initial-permissions"),
      initialRoles: listFlag(flags, "initial-roles"),
      isActive: optionalBooleanFlag(flags, "active"),
      issuer: stringFlag(flags, "issuer") || undefined,
      jwksUri: stringFlag(flags, "jwks-uri") || undefined,
      protocol: stringFlag(flags, "protocol") || undefined,
      provider: stringFlag(flags, "provider") || undefined,
      providerType: stringFlag(flags, "provider-type") || undefined,
      redirectUris: listFlag(flags, "redirect-uris"),
      requirePkce: optionalBooleanFlag(flags, "require-pkce"),
      responseType: stringFlag(flags, "response-type") || undefined,
      scope: stringFlag(flags, "scope") || undefined,
      tokenEndpointAuthMethod: stringFlag(flags, "token-endpoint-auth-method") || undefined,
      tokenUrl: stringFlag(flags, "token-url") || undefined,
      userInfoUrl: stringFlag(flags, "user-info-url") || undefined,
      wellKnownUrl: stringFlag(flags, "well-known-url") || undefined
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
