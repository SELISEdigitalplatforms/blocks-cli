import {
  AccountProfile,
  getAccountProfile,
  readConfig,
  TokenSet,
  writeConfig
} from "./config.js";
import { applyAccountToken, applyProjectToken, isExpiring, TokenResponse } from "./token.js";
import { readTokenStore, writeTokenStore } from "./token-store.js";
import { getClientSecret } from "./secret-store.js";
import { CliActionableError } from "./errors.js";

export type AccountSession = {
  accessToken: string;
  account: string;
  accountTenant: string;
  profile: AccountProfile;
};

export type ProjectSession = {
  accessToken: string;
  account: string;
  accountTenant: string;
  tenantId: string;
};

export type DeviceAuthorizationResponse = {
  device_code: string;
  expires_in: number;
  interval?: number;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
};

export type DevicePollingOptions = {
  onWait?: (seconds: number) => void;
};

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const FALLBACK_IMPERSONATION_CLIENT_ID = "57214b67-aa9c-4307-92ab-a25e35180fac";
const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 3;

export async function requestDeviceAuthorization(profile: AccountProfile): Promise<DeviceAuthorizationResponse> {
  const rootTenantId = await resolveRootTenantForDevice(profile);
  if (!rootTenantId) {
    throw new Error("Device login requires rootTenantId in the account profile.");
  }

  const body = new URLSearchParams({
    client_id: profile.clientId,
    scope: profile.scope
  });
  applyClientSecret(body, await getSecretForProfile(profile));

  const response = await fetch(new URL("/api/oidc/device_authorization", profile.oidcUrl), {
    body,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "x-blocks-key": rootTenantId
    },
    method: "POST"
  });

  const data = parseJson(await response.text()) as Partial<DeviceAuthorizationResponse> & TokenResponse;
  if (!response.ok || data.error) {
    throw new Error(data.error_description ?? data.error ?? `Device authorization failed with HTTP ${response.status}`);
  }

  if (!data.device_code || !data.user_code || !data.verification_uri) {
    throw new Error("Device authorization response is missing required fields.");
  }

  return data as DeviceAuthorizationResponse;
}

export async function pollDeviceToken(profile: AccountProfile, device: DeviceAuthorizationResponse, options: DevicePollingOptions = {}): Promise<TokenResponse> {
  const rootTenantId = await resolveRootTenantForDevice(profile);
  if (!rootTenantId) {
    throw new Error("Device token polling requires rootTenantId in the account profile.");
  }

  let intervalSeconds = Math.max(device.interval ?? 5, 1);
  const deadline = Date.now() + device.expires_in * 1000;
  let consecutiveTransientErrors = 0;

  while (Date.now() < deadline) {
    options.onWait?.(intervalSeconds);
    await delay(Math.min(intervalSeconds * 1000, Math.max(deadline - Date.now(), 0)));

    const body = new URLSearchParams({
      client_id: profile.clientId,
      device_code: device.device_code,
      grant_type: DEVICE_GRANT
    });
    applyClientSecret(body, await getSecretForProfile(profile));

    let response: TokenResponse;
    try {
      response = await postFormToken(profile.oidcUrl, body, rootTenantId, false);
    } catch (error) {
      // The token endpoint itself never throws (postFormToken with
      // throwOnOAuthError=false only returns error payloads) -- a thrown
      // error here means fetch() failed before any response came back
      // (DNS, connection reset, etc.). Treat it as transient and keep
      // polling rather than aborting a multi-minute wait on one blip.
      throwIfTooManyTransientErrors(++consecutiveTransientErrors, error);
      continue;
    }

    if (response.error === "authorization_pending") {
      consecutiveTransientErrors = 0;
      continue;
    }

    if (response.error === "slow_down") {
      consecutiveTransientErrors = 0;
      intervalSeconds += 5;
      continue;
    }

    if (response.error === "token_request_failed") {
      // Synthetic error from postFormToken for a non-JSON HTTP failure
      // (e.g. a 502 from an upstream proxy) -- not a real OAuth rejection,
      // so treat it the same as a network blip.
      throwIfTooManyTransientErrors(++consecutiveTransientErrors, response.error_description ?? response.error);
      continue;
    }

    if (response.error === "access_denied") {
      throw new CliActionableError(
        "Device authorization was denied.",
        "device_login_denied",
        "blocks-os login"
      );
    }

    if (response.error === "expired_token") {
      throw new CliActionableError(
        "Device login expired before approval.",
        "device_login_expired",
        "blocks-os login"
      );
    }

    if (response.error) {
      throw new CliActionableError(
        response.error_description ?? response.error,
        "device_login_failed",
        "blocks-os login"
      );
    }

    return response;
  }

  throw new CliActionableError(
    "Device login expired before approval.",
    "device_login_expired",
    "blocks-os login"
  );
}

function throwIfTooManyTransientErrors(count: number, cause: unknown): void {
  if (count <= MAX_CONSECUTIVE_TRANSIENT_ERRORS) return;

  const detail = cause instanceof Error ? cause.message : String(cause);
  throw new CliActionableError(
    `Could not reach the identity provider while waiting for device approval (${detail}).`,
    "device_login_network_error",
    "Check your network connection and run 'blocks-os login' again."
  );
}

export async function getAccountSession(accountOverride?: string): Promise<AccountSession> {
  let config = await readConfig();
  let store = await readTokenStore();
  const { name, profile } = getAccountProfile(config, accountOverride);
  const token = store.accounts[name]?.account;

  if (!token?.accessToken || !token.accountTenant) {
    throw new Error(`Account '${name}' is not logged in. Run 'blocks-os login' first.`);
  }

  if (!isExpiring(token.expiresAt)) {
    return {
      accessToken: token.accessToken,
      account: name,
      accountTenant: token.accountTenant,
      profile
    };
  }

  if (!token.refreshToken) {
    throw new Error(`Account '${name}' token expired and no refresh token is available. Run 'blocks-os login' again.`);
  }

  const refreshed = await refreshToken(profile.oidcUrl, profile.clientId, token.refreshToken, await getClientSecret(name), profile.rootTenantId ?? token.accountTenant);
  const next = applyAccountToken(config, store, name, profile.clientId, refreshed);
  config = next.config;
  store = next.store;
  await writeConfig(config);
  await writeTokenStore(store);

  const refreshedToken = store.accounts[name]!.account!;
  return {
    accessToken: refreshedToken.accessToken,
    account: name,
    accountTenant: refreshedToken.accountTenant!,
    profile
  };
}

export async function selectProject(tenantId: string): Promise<void> {
  const config = await readConfig();
  await writeConfig({
    ...config,
    selectedProject: {
      ...config.selectedProject,
      tenantId
    }
  });
}

export async function getImpersonatedProjectSession(accountOverride?: string, tenantOverride?: string): Promise<ProjectSession> {
  let config = await readConfig();
  let store = await readTokenStore();
  const { name, profile } = getAccountProfile(config, accountOverride);
  const tenantId = tenantOverride ?? config.selectedProject?.tenantId;
  if (!tenantId) {
    throw new Error("No project selected. Run 'blocks-os use <tenantId>' first.");
  }

  const projectToken = store.accounts[name]?.projects?.[tenantId];
  if (projectToken?.accessToken && !isExpiring(projectToken.expiresAt)) {
    return {
      accessToken: projectToken.accessToken,
      account: name,
      accountTenant: store.accounts[name]?.account?.accountTenant ?? profile.rootTenantId ?? tenantId,
      tenantId
    };
  }

  if (projectToken?.refreshToken) {
    const refreshed = await refreshToken(profile.oidcUrl, profile.clientId, projectToken.refreshToken, await getClientSecret(name), profile.rootTenantId ?? tenantId);
    const next = applyProjectToken(config, store, name, tenantId, refreshed);
    config = next.config;
    store = next.store;
    await writeConfig(config);
    await writeTokenStore(store);

    return projectSessionFromToken(name, tenantId, store.accounts[name]!.projects![tenantId], store.accounts[name]?.account?.accountTenant ?? profile.rootTenantId);
  }

  const account = await getAccountSession(name);
  config = await readConfig();
  store = await readTokenStore();
  const rootRefresh = store.accounts[name]?.account?.refreshToken;
  if (!rootRefresh) {
    throw new Error(`Project impersonation needs a fresh account refresh token. Run 'blocks-os login' again.`);
  }

  const data = await impersonateProject({
    accessToken: account.accessToken,
    accountTenant: account.accountTenant,
    apiUrl: profile.apiUrl,
    clientId: profile.clientId,
    refreshToken: rootRefresh,
    tenantId
  });

  const next = applyProjectToken(config, store, name, tenantId, data);
  const token = next.store.accounts[name]?.account;
  if (token) {
    next.store.accounts[name]!.account = {
      ...token,
      refreshToken: undefined
    };
  }

  await writeConfig(next.config);
  await writeTokenStore(next.store);
  return projectSessionFromToken(name, tenantId, next.store.accounts[name]!.projects![tenantId], account.accountTenant);
}

export async function revokeCurrentSession(accountOverride?: string): Promise<void> {
  const config = await readConfig();
  const store = await readTokenStore();
  const { name, profile } = getAccountProfile(config, accountOverride);
  const accountToken = store.accounts[name]?.account;
  const projectRefresh = config.selectedProject?.tenantId
    ? store.accounts[name]?.projects?.[config.selectedProject.tenantId]?.refreshToken
    : undefined;
  const refreshToken = projectRefresh ?? accountToken?.refreshToken;

  if (!accountToken?.accessToken || !accountToken.accountTenant || !refreshToken) return;

  const response = await fetch(new URL("/iam/v4/api/auth/logout", profile.apiUrl), {
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accountToken.accessToken}`,
      "Content-Type": "application/json",
      "x-blocks-key": accountToken.accountTenant
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Logout revoke failed with HTTP ${response.status}${body ? `: ${body}` : ""}`);
  }
}

async function refreshToken(oidcUrl: string, clientId: string, refreshToken: string, clientSecret?: string, rootTenantId?: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  applyClientSecret(body, clientSecret);

  try {
    return await postFormToken(oidcUrl, body, rootTenantId);
  } catch (error) {
    if (error instanceof OidcResponseError) {
      // The OIDC server's exact wording for an expired/revoked refresh token
      // varies (invalid_grant, blank description, etc.) -- don't depend on it.
      // Always surface a clear, consistent next step instead.
      throw new CliActionableError(
        `Refresh token was rejected by the identity provider (${error.message}).`,
        "refresh_token_rejected",
        "blocks-os login"
      );
    }

    // fetch() itself failed (DNS, connection refused, TLS, etc.) -- the
    // refresh token may still be valid, so don't tell the user to log in.
    const detail = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(
      `Could not reach the identity provider to refresh the token (${detail}).`,
      "refresh_network_error",
      "Check your network connection and the configured OIDC URL, then retry."
    );
  }
}

async function impersonateProject(args: {
  accessToken: string;
  accountTenant: string;
  apiUrl: string;
  clientId: string;
  refreshToken: string;
  tenantId: string;
}): Promise<TokenResponse> {
  const first = await postImpersonate(args, args.clientId);
  if (first.ok) return first.data;

  const message = first.data.error_description ?? first.data.error ?? "";
  if (args.clientId !== FALLBACK_IMPERSONATION_CLIENT_ID && /invalid_client|client configuration/i.test(message)) {
    const fallback = await postImpersonate(args, FALLBACK_IMPERSONATION_CLIENT_ID);
    if (fallback.ok) return fallback.data;
    throw new Error(fallback.data.error_description ?? fallback.data.error ?? `Impersonation failed with HTTP ${fallback.status}`);
  }

  throw new Error(first.data.error_description ?? first.data.error ?? `Impersonation failed with HTTP ${first.status}`);
}

async function postImpersonate(args: {
  accessToken: string;
  accountTenant: string;
  apiUrl: string;
  refreshToken: string;
  tenantId: string;
}, clientId: string): Promise<{ data: TokenResponse; ok: boolean; status: number }> {
  const response = await fetch(new URL("/iam/v4/auth/impersonate", args.apiUrl), {
    body: JSON.stringify({
      client_id: clientId,
      refresh_token: args.refreshToken,
      targeted_tenant_id: args.tenantId
    }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
      "Content-Type": "application/json",
      "x-blocks-key": args.accountTenant
    },
    method: "POST"
  });

  const data = parseJson(await response.text()) as TokenResponse;
  return {
    data,
    ok: response.ok && !data.error,
    status: response.status
  };
}

// Thrown only once we have an actual response from the identity provider
// that rejects the request (bad grant, bad client, etc.) -- as opposed to
// fetch() itself failing before any response came back.
class OidcResponseError extends Error {}

async function postFormToken(
  oidcUrl: string,
  body: URLSearchParams,
  rootTenantId?: string,
  throwOnOAuthError = true
): Promise<TokenResponse> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/x-www-form-urlencoded"
  };

  if (rootTenantId) headers["x-blocks-key"] = rootTenantId;

  const response = await fetch(new URL("/api/oidc/token", oidcUrl), {
    body,
    headers,
    method: "POST"
  });

  const data = parseJson(await response.text()) as TokenResponse;
  if (throwOnOAuthError && (!response.ok || data.error)) {
    throw new OidcResponseError(data.error_description ?? data.error ?? `OIDC token request failed with HTTP ${response.status}`);
  }

  if (!response.ok && !data.error) {
    return {
      error: "token_request_failed",
      error_description: `OIDC token request failed with HTTP ${response.status}`
    };
  }

  return data;
}

function projectSessionFromToken(account: string, tenantId: string, token: TokenSet, accountTenant?: string): ProjectSession {
  return {
    accessToken: token.accessToken,
    account,
    accountTenant: accountTenant ?? tenantId,
    tenantId
  };
}

function parseJson(text: string): unknown {
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: "invalid_response",
      error_description: text
    };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyClientSecret(body: URLSearchParams, clientSecret?: string): void {
  if (clientSecret) body.set("client_secret", clientSecret);
}

async function getSecretForProfile(profile: AccountProfile): Promise<string | undefined> {
  const config = await readConfig();
  for (const [account, accountProfile] of Object.entries(config.accounts)) {
    if (accountProfile.clientId === profile.clientId && accountProfile.oidcUrl === profile.oidcUrl) {
      return await getClientSecret(account);
    }
  }

  return undefined;
}

async function resolveRootTenantForDevice(profile: AccountProfile): Promise<string | undefined> {
  if (profile.rootTenantId) return profile.rootTenantId;

  const config = await readConfig();
  const store = await readTokenStore();
  for (const [account, accountProfile] of Object.entries(config.accounts)) {
    if (accountProfile.apiUrl === profile.apiUrl && accountProfile.clientId === profile.clientId) {
      const accountTenant = store.accounts[account]?.account?.accountTenant;
      if (accountTenant) return accountTenant;
    }
  }

  return undefined;
}
