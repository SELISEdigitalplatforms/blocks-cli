import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Upsert: omit --item-id to register a new OIDC client, pass it to update an existing one. */
export async function authOidcClientsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      allowedMfaMethods: listFlag(flags, "allowed-mfa-methods")?.map(Number),
      allowedResponseTypes: listFlag(flags, "allowed-response-types"),
      allowedScopes: listFlag(flags, "allowed-scopes"),
      backChannelLogoutUri: stringFlag(flags, "back-channel-logout-uri") || undefined,
      clientBrandColor: stringFlag(flags, "client-brand-color") || undefined,
      clientDisplayName: stringFlag(flags, "client-display-name") || undefined,
      clientLogoUrl: stringFlag(flags, "client-logo-url") || undefined,
      clientType: stringFlag(flags, "client-type") || undefined,
      externalDiscoveryEndpoint: stringFlag(flags, "external-discovery-endpoint") || undefined,
      frontChannelLogoutUri: stringFlag(flags, "front-channel-logout-uri") || undefined,
      isActive: optionalBooleanFlag(flags, "active"),
      isAutoRedirect: optionalBooleanFlag(flags, "auto-redirect"),
      isDeviceFlowClient: optionalBooleanFlag(flags, "device-flow-client"),
      itemId: stringFlag(flags, "item-id") || undefined,
      loginMode: stringFlag(flags, "login-mode") || undefined,
      postLogoutRedirectUris: listFlag(flags, "post-logout-redirect-uris"),
      redirectUris: listFlag(flags, "redirect-uris"),
      registerAsIdentityProvider: optionalBooleanFlag(flags, "register-as-identity-provider"),
      requireConsent: optionalBooleanFlag(flags, "require-consent"),
      requireMfa: optionalBooleanFlag(flags, "require-mfa"),
      requirePkce: optionalBooleanFlag(flags, "require-pkce"),
      scope: stringFlag(flags, "scope") || undefined,
      useTokensCookie: optionalBooleanFlag(flags, "use-tokens-cookie")
    })
  };

  const projectKey = await selectedProject(flags);
  const itemId = typeof overrides.itemId === "string" ? overrides.itemId : undefined;

  // Saving an existing client (itemId set) replaces the whole client document
  // rather than merging -- the portal's own Edit dialog always resubmits every
  // field, including ones this command wasn't asked to change. Fetch the
  // current client first so unmentioned fields (redirectUris, scope, PKCE, ...)
  // survive instead of being reset to defaults. A new client (no itemId) has
  // no prior state to merge.
  const current = itemId
    ? await blocksRequest<Record<string, unknown>>(`/iam/v4/oidc-clients/${encodeURIComponent(itemId)}`, {
        impersonatedProjectAuth: true,
        ...requestContext(flags),
        projectTenantId: projectKey
      })
    : {};
  const body = { ...current, ...overrides };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/oidc-clients", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save OIDC client '${body.clientDisplayName ?? body.itemId ?? "(new)"}'. The response's client secret is shown once.`);
  const result = await blocksRequest<unknown>("/iam/v4/oidc-clients", {
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
