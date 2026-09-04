import { blocksRequest } from "./api.js";
import { isRecord } from "./data-response.js";
import { carryCurrent } from "./merge-current.js";
import { requestContext } from "./request-context.js";

type Flags = Record<string, string | boolean>;

/**
 * SaveOIDCClientRequest's own fields, exactly -- what a merged save is allowed to
 * carry from the stored client. The GET's nested entity carries more (clientId,
 * clientSecret, timestamps, tenant metadata); a full spread would echo the SECRET
 * back at the API and hand the binder junk, so the carry is a named allowlist.
 * `scope` is deliberately absent: it is a derived view of allowedScopes on both
 * sides, and carrying both would let a stale one win.
 */
const OIDC_CLIENT_SAVE_FIELDS = [
  "itemId",
  "clientDisplayName",
  "clientType",
  "redirectUris",
  "postLogoutRedirectUris",
  "allowedScopes",
  "allowedResponseTypes",
  "requirePkce",
  "requireConsent",
  "frontChannelLogoutUri",
  "backChannelLogoutUri",
  "isAutoRedirect",
  "externalDiscoveryEndpoint",
  "isActive",
  "loginMode",
  "useTokensCookie",
  "requireMfa",
  "allowedMfaMethods",
  "registerAsIdentityProvider",
  "isDeviceFlowClient"
] as const;

/**
 * One OIDC client, unwrapped. GET /oidc-clients/{id} answers with an envelope --
 * `{ isSuccess, oIDCClientCredential: {...} }` -- not the client itself; spreading the
 * envelope into a save body carries none of the real fields (which is how a
 * roles-only re-save used to reset isAutoRedirect and requirePkce to the DTO
 * defaults). Returns undefined when the response holds no client.
 */
export async function readOidcClient(
  clientId: string,
  projectKey: string,
  flags: Flags
): Promise<Record<string, unknown> | undefined> {
  const response = await blocksRequest<unknown>(`/iam/v4/oidc-clients/${encodeURIComponent(clientId)}`, {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  if (!isRecord(response)) return undefined;
  const nested = response.oIDCClientCredential ?? response.oidcClientCredential;
  return isRecord(nested) ? nested : undefined;
}

/** The save-DTO subset of a stored client, ready to spread under a save body's overrides. */
export function carryOidcClient(client: Record<string, unknown> | undefined): Record<string, unknown> {
  return carryCurrent(client, OIDC_CLIENT_SAVE_FIELDS);
}
