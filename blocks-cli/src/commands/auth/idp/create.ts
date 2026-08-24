import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * The endpoint URLs are not decoration: `GET /iam/v4/idp/initiate` builds the
 * provider authorize URL from the stored `authorizationUrl` and falls back to an
 * empty base when it is missing, so a provider saved without it hands the browser
 * a bare query string. Apple-only fields (teamId/keyId/privateKey/appleAudience)
 * stay in --body/--file so no private key lands in shell history.
 */
export async function authIdpCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      authorizationUrl: stringFlag(flags, "authorization-url") || undefined,
      clientId: stringFlag(flags, "client-id") || undefined,
      clientSecret: stringFlag(flags, "client-secret") || undefined,
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
