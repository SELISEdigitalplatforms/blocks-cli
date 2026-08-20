import { BlocksAuthenticationClient } from "./auth/auth-client.js";
import { BlocksDataClient } from "./data/data-client.js";
import { BlocksHttpClient } from "./http/http-client.js";
import { BlocksIAMClient } from "./iam/iam-client.js";
import { BlocksLocalizationClient } from "./localization/localization-client.js";
import { BlocksMailClient } from "./mail/mail-client.js";
import { BlocksMfaClient } from "./mfa/mfa-client.js";
import { BlocksNotifierClient } from "./notifier/notifier-client.js";

export type BlocksOidcConfig = {
  /**
   * Public browser OIDC client id used by Blocks IAM IdpController and refresh-token calls.
   */
  clientId: string;

  /**
   * Browser callback URL registered for the client. Defaults to `<origin>/login/callback` in browsers.
   */
  redirectUri?: string;

  /**
   * OIDC scope used by default for hosted login/refresh helpers. Defaults to `openid profile`.
   */
  scope?: string;

  /**
   * IAM/OIDC authority URL kept for app-level metadata. Blocks API calls in this SDK use `apiUrl`.
   */
  url: string;
};

export type BlocksClientConfig = {
  /**
   * Caller-owned bearer token or token resolver.
   * The SDK reads it before protected API calls, but never stores, refreshes, or clears it.
   */
  accessToken?: string | (() => Promise<string | undefined> | string | undefined);

  /**
   * Blocks API base URL, for example `https://api.seliseblocks.com`.
   */
  apiUrl: string;

  /**
   * Optional Blocks application domain for consumer app metadata.
   */
  appDomain?: string;

  /**
   * Optional fetch-compatible function for tests, SSR, or custom runtimes.
   */
  fetch?: typeof fetch;

  /**
   * Caller-owned hook invoked at most once per request when a protected call comes back 401.
   * Should resolve a fresh token (deduping concurrent callers itself, e.g. via a shared
   * in-flight refresh promise) or `undefined` if the session cannot be recovered -- the SDK
   * retries the request once with the returned token, or leaves the 401 to throw if none.
   */
  onUnauthorized?: () => Promise<string | undefined> | string | undefined;

  /**
   * Optional hosted IdP/OIDC browser-flow configuration.
   */
  oidc?: BlocksOidcConfig;

  /**
   * Required Blocks tenant key. The SDK sends this as the `x-blocks-key` header on every request.
   */
  xBlocksKey: string;
};

export type BlocksClient = {
  auth: BlocksAuthenticationClient;
  config: Readonly<RequiredConfig>;
  data: BlocksDataClient;
  http: BlocksHttpClient;
  iam: BlocksIAMClient;
  localization: BlocksLocalizationClient;
  mail: BlocksMailClient;
  mfa: BlocksMfaClient;
  notifier: BlocksNotifierClient;
};

export type RequiredConfig = {
  accessToken?: string | (() => Promise<string | undefined> | string | undefined);
  apiUrl: string;
  appDomain?: string;
  onUnauthorized?: () => Promise<string | undefined> | string | undefined;
  oidc?: BlocksOidcConfig & { redirectUri: string; scope: string };
  xBlocksKey: string;
};

/**
 * What: creates a framework-neutral Blocks SDK instance for one tenant/app runtime.
 * Why: frontend code needs a single configured entry point for IAM, Auth, Data, and Localization APIs.
 * How: pass `apiUrl` and `xBlocksKey`; optionally pass an `accessToken` callback and OIDC config. The SDK never adds `ProjectKey` and never stores tokens.
 */
export function createBlocksClient(config: BlocksClientConfig): BlocksClient {
  const normalized = normalizeConfig(config);
  const auth = new BlocksAuthenticationClient(normalized, config.fetch);
  const http = new BlocksHttpClient(normalized, auth, config.fetch);

  return {
    auth,
    config: normalized,
    data: new BlocksDataClient(http),
    http,
    iam: new BlocksIAMClient(http),
    localization: new BlocksLocalizationClient(http),
    mail: new BlocksMailClient(http),
    mfa: new BlocksMfaClient(http),
    notifier: new BlocksNotifierClient(http)
  };
}

function normalizeConfig(config: BlocksClientConfig): RequiredConfig {
  if (!config.apiUrl) throw new Error("Blocks client requires apiUrl.");
  if (!config.xBlocksKey) throw new Error("Blocks client requires xBlocksKey.");

  return {
    accessToken: config.accessToken,
    apiUrl: trimTrailingSlash(config.apiUrl),
    appDomain: config.appDomain,
    onUnauthorized: config.onUnauthorized,
    oidc: config.oidc ? {
      ...config.oidc,
      redirectUri: config.oidc.redirectUri ?? browserRedirectUri(),
      scope: config.oidc.scope ?? "openid profile"
    } : undefined,
    xBlocksKey: config.xBlocksKey
  };
}

function browserRedirectUri(): string {
  if (typeof window === "undefined") {
    throw new Error("OIDC redirectUri is required outside a browser.");
  }

  return `${window.location.origin}/login/callback`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
