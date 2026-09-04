import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { defaults } from "../../../lib/config.js";
import { CliActionableError } from "../../../lib/errors.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { carryOidcClient, readOidcClient } from "../../../lib/oidc-client.js";
import { withBlocksIdentityProviderDiscovery } from "../../../lib/oidc-discovery.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
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
  const oidcUrl = stringFlag(flags, "oidc-url", { defaultValue: defaults().oidcUrl });
  const itemId = typeof overrides.itemId === "string" ? overrides.itemId : undefined;

  // Saving an existing client (itemId set) replaces the whole client document
  // rather than merging -- the portal's own Edit dialog always resubmits every
  // field, including ones this command wasn't asked to change. Fetch the current
  // client first so unmentioned fields (redirectUris, isAutoRedirect, PKCE, ...)
  // survive instead of being reset to defaults. readOidcClient unwraps the GET's
  // envelope and carryOidcClient copies only the save DTO's fields -- spreading
  // the raw response used to carry NOTHING (the client is nested) while echoing
  // the stored clientSecret back at the API. A new client (no itemId) has no
  // prior state to merge.
  let current: Record<string, unknown> = {};
  if (itemId) {
    const client = await readOidcClient(itemId, projectKey, flags);
    if (!client) {
      throw new CliActionableError(
        `OIDC client '${itemId}' was not found in this project.`,
        "oidc_client_not_found",
        "Run 'blocks auth oidc-clients list --json' and pass one of the listed ids as --item-id, or omit --item-id to register a new client."
      );
    }
    current = carryOidcClient(client);
  }

  // Registering a NEW client is the bootstrap path, and a bootstrap client that
  // omits these two is not a working login:
  //   isAutoRedirect        -- without it IAM parks the user on an interstitial
  //                            "continue" page instead of redirecting to the provider.
  //   registerAsIdentityProvider -- without it no identity provider is linked, so
  //                            '/idp/initiate' has nothing to redirect to.
  // Both stay explicitly overridable (`--auto-redirect=false`), and neither is
  // defaulted when updating an existing client, where `current` already carries
  // whatever was chosen at registration time.
  const newClientDefaults = itemId ? {} : { isAutoRedirect: true, registerAsIdentityProvider: true };
  const body = withBlocksIdentityProviderDiscovery(
    { ...newClientDefaults, ...current, ...overrides },
    oidcUrl,
    projectKey
  );

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/oidc-clients", request: redactSecrets(body) }, flags);
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
