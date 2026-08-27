import {
  AccountProfile,
  readConfig,
  resolveAccountProfile,
  TokenSet,
  writeConfig
} from "./config.js";
import { applyAccountToken, applyProjectToken, isExpiring, TokenResponse } from "./token.js";
import { readTokenStore, writeTokenStore } from "./token-store.js";
import { getClientSecret } from "./secret-store.js";
import { CliActionableError } from "./errors.js";
import { withAuthTransitionLock } from "./auth-lock.js";

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

export type SessionOptions = {
  // Bypass the local expiresAt cache and refresh before returning -- used to
  // recover from a 401 that the local expiry check didn't predict (early
  // server-side revocation, clock skew), instead of failing the command.
  forceRefresh?: boolean;
};

export type AccountModeResult<T> = {
  previousProject?: string;
  restoreError?: Error;
  result: T;
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
  accountName?: string;
  onWait?: (seconds: number) => void;
};

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const MAX_CONSECUTIVE_TRANSIENT_ERRORS = 3;

export async function requestDeviceAuthorization(profile: AccountProfile, accountName?: string): Promise<DeviceAuthorizationResponse> {
  const rootTenantId = await resolveRootTenantForDevice(profile, accountName);
  if (!rootTenantId) {
    throw new Error("Device login requires rootTenantId in the account profile.");
  }

  const body = new URLSearchParams({
    client_id: profile.clientId,
    scope: profile.scope
  });
  applyClientSecret(body, await getSecretForProfile(accountName));

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
  const rootTenantId = await resolveRootTenantForDevice(profile, options.accountName);
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
    applyClientSecret(body, await getSecretForProfile(options.accountName));

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
        "blocks login"
      );
    }

    if (response.error === "expired_token") {
      throw new CliActionableError(
        "Device login expired before approval.",
        "device_login_expired",
        "blocks login"
      );
    }

    if (response.error) {
      throw new CliActionableError(
        response.error_description ?? response.error,
        "device_login_failed",
        "blocks login"
      );
    }

    return response;
  }

  throw new CliActionableError(
    "Device login expired before approval.",
    "device_login_expired",
    "blocks login"
  );
}

function throwIfTooManyTransientErrors(count: number, cause: unknown): void {
  if (count <= MAX_CONSECUTIVE_TRANSIENT_ERRORS) return;

  const detail = cause instanceof Error ? cause.message : String(cause);
  throw new CliActionableError(
    `Could not reach the identity provider while waiting for device approval (${detail}).`,
    "device_login_network_error",
    "Check your network connection and run 'blocks login' again."
  );
}

export async function getAccountSession(accountOverride?: string, options: SessionOptions = {}): Promise<AccountSession> {
  const config = await readConfig();
  const store = await readTokenStore();
  const { name, profile } = await resolveAccountProfile(config, accountOverride);
  const token = store.accounts[name]?.account;
  if (!options.forceRefresh && !isExpiring(token?.expiresAt)) {
    if (token?.accessToken && token.accountTenant) return accountSessionFromToken(name, profile, token);
  }

  return await withAuthTransitionLock(() => getAccountSessionUnlocked(name, options));
}

export async function getImpersonatedProjectSession(accountOverride?: string, tenantOverride?: string, options: SessionOptions = {}): Promise<ProjectSession> {
  const config = await readConfig();
  const store = await readTokenStore();
  const { name, profile } = await resolveAccountProfile(config, accountOverride);
  const tenantId = tenantOverride ?? profile.selectedProject?.tenantId;
  if (!tenantId) {
    throw new Error("No project selected. Run 'blocks use <tenantId>' first.");
  }

  const projectToken = store.accounts[name]?.projects?.[tenantId];
  if (!options.forceRefresh && projectToken?.accessToken && !isExpiring(projectToken.expiresAt)) {
    return projectSessionFromToken(name, tenantId, projectToken, profile.rootTenantId);
  }

  return await withAuthTransitionLock(() => getImpersonatedProjectSessionUnlocked(name, tenantId, options));
}

// Ends the active project impersonation and restores a fresh, refreshable
// account-level session. The IAM server revokes the account refresh token the
// moment it's used to start an impersonation (see impersonateProject) and
// only ever hands back a project-scoped one in exchange -- calling
// '/impersonation/stop' is the only way to get a new account-level refresh
// token back. No-ops if no project is selected or nothing was ever
// impersonated for it.
export async function stopProjectImpersonation(accountOverride?: string, tenantOverride?: string): Promise<void> {
  await withAuthTransitionLock(() => stopProjectImpersonationUnlocked(accountOverride, tenantOverride));
}

export async function withAccountMode<T>(
  accountOverride: string | undefined,
  operation: (account: AccountSession) => Promise<T>,
  options: { restoreProject?: boolean } = { restoreProject: true }
): Promise<AccountModeResult<T>> {
  return await withAuthTransitionLock(async () => {
    const config = await readConfig();
    const store = await readTokenStore();
    const { name } = await resolveAccountProfile(config, accountOverride);
    const previousProject = currentProjectTenant(store, name);

    if (previousProject) await stopProjectImpersonationUnlocked(name, previousProject);
    const account = await getAccountSessionUnlocked(name);

    let result!: T;
    let operationError: unknown;
    try {
      result = await operation(account);
    } catch (error) {
      operationError = error;
    }

    let restoreError: Error | undefined;
    if (previousProject && options.restoreProject !== false) {
      try {
        await getImpersonatedProjectSessionUnlocked(name, previousProject);
      } catch (error) {
        restoreError = error instanceof Error ? error : new Error(String(error));
      }
    }

    if (operationError !== undefined) {
      if (restoreError) {
        throw new AggregateError([operationError, restoreError], "Account operation failed and the previous project session could not be restored.");
      }
      throw operationError;
    }

    return { previousProject, restoreError, result };
  });
}

export async function storeAccountLogin(
  account: string,
  profile: AccountProfile,
  token: TokenResponse
): Promise<void> {
  requireRefreshToken(token, "Account login");
  await withAuthTransitionLock(async () => {
    const config = await readConfig();
    const store = await readTokenStore();
    const next = applyAccountToken(config, store, account, profile.clientId, token, { activateAccount: true });
    await writeConfig(next.config);
    await writeTokenStore(next.store);
  });
}

export async function logoutCurrentSession(
  accountOverride?: string,
  tenantOverride?: string
): Promise<{ account: string; hadTokens: boolean; warning?: string }> {
  return await withAuthTransitionLock(async () => {
    const config = await readConfig();
    const store = await readTokenStore();
    const { name, profile } = await resolveAccountProfile(config, accountOverride);
    const hadTokens = Boolean(store.accounts[name]?.account || currentProjectTenant(store, name));
    let warning: string | undefined;

    try {
      const projectTenant = currentProjectTenant(store, name, tenantOverride);
      if (projectTenant) {
        const project = await getImpersonatedProjectSessionUnlocked(name, projectTenant);
        const latest = await readTokenStore();
        const refreshToken = latest.accounts[name]?.projects?.[projectTenant]?.refreshToken;
        if (refreshToken) await postLogout(profile.apiUrl, project.accessToken, project.accountTenant, refreshToken);
      } else if (store.accounts[name]?.account) {
        const account = await getAccountSessionUnlocked(name);
        const latest = await readTokenStore();
        const refreshToken = latest.accounts[name]?.account?.refreshToken;
        if (refreshToken) await postLogout(profile.apiUrl, account.accessToken, account.accountTenant, refreshToken);
      }
    } catch (error) {
      warning = error instanceof Error ? error.message : String(error);
    }

    const latest = await readTokenStore();
    if (latest.accounts[name]) {
      const { [name]: _removed, ...accounts } = latest.accounts;
      await writeTokenStore({ accounts });
    }
    return { account: name, hadTokens, warning };
  });
}

async function getAccountSessionUnlocked(accountOverride?: string, options: SessionOptions = {}): Promise<AccountSession> {
  const config = await readConfig();
  const store = await readTokenStore();
  const { name, profile } = await resolveAccountProfile(config, accountOverride);
  const token = store.accounts[name]?.account;

  if (!token?.accessToken || !token.accountTenant) {
    if (currentProjectTenant(store, name)) {
      throw new CliActionableError(
        `Account '${name}' is currently impersonating a project.`,
        "account_session_suspended",
        "Run 'blocks deselect' before an account-only operation."
      );
    }
    throw new Error(`Account '${name}' is not logged in. Run 'blocks login' first.`);
  }

  if (!options.forceRefresh && !isExpiring(token.expiresAt)) return accountSessionFromToken(name, profile, token);
  if (!token.refreshToken) {
    throw new Error(`Account '${name}' token expired and no refresh token is available. Run 'blocks login' again.`);
  }

  const refreshed = await refreshToken(profile.oidcUrl, profile.clientId, token.refreshToken, await getClientSecret(name), profile.rootTenantId ?? token.accountTenant);
  const next = applyAccountToken(config, store, name, profile.clientId, refreshed);
  await writeConfig(next.config);
  await writeTokenStore(next.store);
  return accountSessionFromToken(name, profile, next.store.accounts[name]!.account!);
}

async function getImpersonatedProjectSessionUnlocked(
  accountOverride?: string,
  tenantOverride?: string,
  options: SessionOptions = {}
): Promise<ProjectSession> {
  const config = await readConfig();
  const { name, profile } = await resolveAccountProfile(config, accountOverride);
  const tenantId = tenantOverride ?? profile.selectedProject?.tenantId;
  if (!tenantId) throw new Error("No project selected. Run 'blocks use <tenantId>' first.");

  let store = await readTokenStore();
  let projectToken = store.accounts[name]?.projects?.[tenantId];
  if (!options.forceRefresh && projectToken?.accessToken && !isExpiring(projectToken.expiresAt)) {
    return projectSessionFromToken(name, tenantId, projectToken, profile.rootTenantId);
  }

  if (projectToken?.refreshToken) {
    const refreshed = await refreshToken(profile.oidcUrl, profile.clientId, projectToken.refreshToken, await getClientSecret(name), profile.rootTenantId ?? tenantId);
    const next = applyProjectToken(config, store, name, tenantId, refreshed);
    await writeConfig(next.config);
    await writeTokenStore(next.store);
    return projectSessionFromToken(name, tenantId, next.store.accounts[name]!.projects![tenantId], profile.rootTenantId);
  }

  const currentProject = currentProjectTenant(store, name);
  if (currentProject && currentProject !== tenantId) {
    await stopProjectImpersonationUnlocked(name, currentProject);
    store = await readTokenStore();
    projectToken = store.accounts[name]?.projects?.[tenantId];
  }

  const account = await getAccountSessionUnlocked(name, options);
  store = await readTokenStore();
  const rootRefresh = store.accounts[name]?.account?.refreshToken;
  if (!rootRefresh) throw new Error("Project impersonation needs a fresh account refresh token. Run 'blocks login' again.");

  const data = await impersonateProject({
    accessToken: account.accessToken,
    accountTenant: account.accountTenant,
    apiUrl: profile.apiUrl,
    clientId: profile.clientId,
    refreshToken: rootRefresh,
    tenantId
  });
  requireRefreshToken(data, "Project impersonation");
  const next = applyProjectToken(config, store, name, tenantId, data);
  await writeConfig(next.config);
  await writeTokenStore(next.store);
  return projectSessionFromToken(name, tenantId, next.store.accounts[name]!.projects![tenantId], profile.rootTenantId ?? account.accountTenant);
}

async function stopProjectImpersonationUnlocked(accountOverride?: string, tenantOverride?: string): Promise<void> {
  const config = await readConfig();
  const { name, profile } = await resolveAccountProfile(config, accountOverride);
  const store = await readTokenStore();
  const tenantId = currentProjectTenant(store, name, tenantOverride) ?? profile.selectedProject?.tenantId;
  if (!tenantId) return;

  const storedProject = store.accounts[name]?.projects?.[tenantId];
  if (!storedProject) return;
  if (!storedProject.refreshToken) {
    throw new CliActionableError(
      `Project session '${tenantId}' has no refresh token and cannot be stopped safely.`,
      "project_refresh_token_missing",
      `blocks login --account ${name}`
    );
  }
  const project = await getImpersonatedProjectSessionUnlocked(name, tenantId);
  const beforeStop = await readTokenStore();
  const projectToken = beforeStop.accounts[name]?.projects?.[tenantId];
  if (!projectToken?.refreshToken) return;

  const refreshed = await postStopImpersonation(profile.apiUrl, project.accessToken, project.accountTenant, projectToken.refreshToken);
  requireRefreshToken(refreshed, "Stop impersonation");
  const latestConfig = await readConfig();
  const latestStore = await readTokenStore();
  const next = applyAccountToken(latestConfig, latestStore, name, profile.clientId, refreshed);
  await writeConfig(next.config);
  await writeTokenStore(next.store);
}

async function postStopImpersonation(apiUrl: string, accessToken: string, accountTenant: string, refreshToken: string): Promise<TokenResponse> {
  const response = await fetch(new URL("/iam/v4/auth/impersonation/stop", apiUrl), {
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-blocks-key": accountTenant
    },
    method: "POST"
  });

  const data = parseJson(await response.text()) as TokenResponse;
  if (response.ok && !data.error) return data;

  throw new Error(data.error_description ?? data.error ?? `Stop impersonation failed with HTTP ${response.status}`);
}

async function postLogout(apiUrl: string, accessToken: string, accountTenant: string, refreshToken: string): Promise<void> {
  const response = await fetch(new URL("/iam/v4/api/auth/logout", apiUrl), {
    body: JSON.stringify({ refresh_token: refreshToken }),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-blocks-key": accountTenant
    },
    method: "POST"
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Logout revoke failed with HTTP ${response.status}${body ? `: ${body}` : ""}`);
  }
}

function accountSessionFromToken(name: string, profile: AccountProfile, token: TokenSet): AccountSession {
  return {
    accessToken: token.accessToken,
    account: name,
    accountTenant: token.accountTenant!,
    profile
  };
}

function currentProjectTenant(store: Awaited<ReturnType<typeof readTokenStore>>, account: string, preferred?: string): string | undefined {
  const projects = store.accounts[account]?.projects ?? {};
  if (preferred && projects[preferred]) return preferred;
  return Object.entries(projects).find(([, token]) => Boolean(token.refreshToken))?.[0]
    ?? Object.keys(projects)[0];
}

function requireRefreshToken(response: TokenResponse, operation: string): void {
  if (!response.refresh_token) throw new Error(`${operation} did not return a refresh token.`);
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
        "blocks login"
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
  const response = await fetch(new URL("/iam/v4/auth/impersonate", args.apiUrl), {
    body: JSON.stringify({
      client_id: args.clientId,
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
  if (response.ok && !data.error) return data;

  const message = data.error_description ?? data.error ?? "";
  if (/invalid_client|client configuration/i.test(message)) {
    throw new CliActionableError(
      `Impersonation failed: the account's OIDC client ('${args.clientId}') is not registered for impersonation (${message}).`,
      "impersonation_invalid_client",
      `Contact an admin to register CLI client '${args.clientId}' for project impersonation. Re-login and auth config changes cannot repair this.`
    );
  }

  throw new Error(message || `Impersonation failed with HTTP ${response.status}`);
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

async function getSecretForProfile(accountName?: string): Promise<string | undefined> {
  return accountName ? await getClientSecret(accountName) : undefined;
}

async function resolveRootTenantForDevice(profile: AccountProfile, accountName?: string): Promise<string | undefined> {
  if (profile.rootTenantId) return profile.rootTenantId;
  if (!accountName) return undefined;

  const store = await readTokenStore();
  return store.accounts[accountName]?.account?.accountTenant;
}
