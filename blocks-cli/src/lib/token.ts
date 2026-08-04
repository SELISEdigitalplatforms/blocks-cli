import { BlocksCliConfig, TokenSet } from "./config.js";
import { decodeJwtPayload, tenantFromToken } from "./jwt.js";
import { BlocksTokenStore } from "./token-store.js";

export type TokenResponse = {
  access_token?: string;
  cookie_set?: boolean;
  error?: string;
  error_description?: string;
  expires_in?: number;
  expires_utc?: string;
  id_token?: string;
  refresh_token?: string;
  refresh_expires_in?: number;
  refresh_expires_utc?: string;
  refresh_token_expires_in?: number;
  scope?: string;
  token_type?: string;
};

const EXPIRY_SKEW_MS = 60_000;
const DEFAULT_REFRESH_TOKEN_LIFETIME_SECONDS = 30 * 60;

function parseUtcTimestamp(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function expiresAtFromToken(response: TokenResponse, accessToken: string): string | undefined {
  const utc = parseUtcTimestamp(response.expires_utc);
  if (utc) return utc;

  if (typeof response.expires_in === "number" && response.expires_in > 0) {
    return new Date(Date.now() + response.expires_in * 1000).toISOString();
  }

  const payload = decodeJwtPayload(accessToken);
  if (typeof payload.exp === "number") {
    return new Date(payload.exp * 1000).toISOString();
  }

  return undefined;
}

export function expiresAtFromJwtFirst(response: TokenResponse, accessToken: string): string | undefined {
  const payload = decodeJwtPayload(accessToken);
  if (typeof payload.exp === "number") {
    return new Date(payload.exp * 1000).toISOString();
  }

  return expiresAtFromToken(response, accessToken);
}

export function refreshExpiresAtFromToken(response: TokenResponse, refreshToken?: string): string | undefined {
  const utc = parseUtcTimestamp(response.refresh_expires_utc);
  if (utc) return utc;

  if (refreshToken) {
    try {
      const payload = decodeJwtPayload(refreshToken);
      if (typeof payload.exp === "number") {
        return new Date(payload.exp * 1000).toISOString();
      }
    } catch {
      // Opaque refresh tokens have no JWT payload; use server metadata or the configured lifetime.
    }
  }

  const expiresIn = response.refresh_expires_in ?? response.refresh_token_expires_in;
  if (typeof expiresIn === "number" && expiresIn > 0) {
    return new Date(Date.now() + expiresIn * 1000).toISOString();
  }

  return refreshToken
    ? new Date(Date.now() + DEFAULT_REFRESH_TOKEN_LIFETIME_SECONDS * 1000).toISOString()
    : undefined;
}

export function isExpiring(expiresAt?: string): boolean {
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() - EXPIRY_SKEW_MS <= Date.now();
}

export function applyAccountToken(
  config: BlocksCliConfig,
  store: BlocksTokenStore,
  account: string,
  clientId: string,
  response: TokenResponse
): { config: BlocksCliConfig; store: BlocksTokenStore } {
  if (!response.access_token) {
    throw new Error(response.error_description ?? response.error ?? "Token response did not include an access token");
  }

  // Some OIDC servers omit refresh_token on a refresh call when they didn't
  // rotate it (still valid, just not reissued) -- fall back to the previous
  // one instead of overwriting a working refresh token with undefined.
  const previousRefreshToken = store.accounts[account]?.account?.refreshToken;
  const previousRefreshTokenExpiresAt = store.accounts[account]?.account?.refreshTokenExpiresAt;
  const refreshToken = response.refresh_token ?? previousRefreshToken;

  const tokenSet: TokenSet = {
    accessToken: response.access_token,
    accountTenant: tenantFromToken(response.access_token),
    expiresAt: expiresAtFromJwtFirst(response, response.access_token),
    idToken: response.id_token,
    refreshToken,
    refreshTokenExpiresAt: response.refresh_token
      ? refreshExpiresAtFromToken(response, response.refresh_token)
      : previousRefreshTokenExpiresAt,
    scope: response.scope,
    tokenType: response.token_type ?? "Bearer"
  };

  return {
    config: {
      ...config,
      activeAccount: account,
      accounts: {
        ...config.accounts,
        [account]: {
          ...config.accounts[account],
          clientId,
          updatedAt: new Date().toISOString()
        }
      }
    },
    store: {
      accounts: {
        ...store.accounts,
        [account]: {
          ...(store.accounts[account] ?? {}),
          account: tokenSet
        }
      }
    }
  };
}

export function applyProjectToken(
  config: BlocksCliConfig,
  store: BlocksTokenStore,
  account: string,
  tenantId: string,
  response: TokenResponse
): { config: BlocksCliConfig; store: BlocksTokenStore } {
  if (!response.access_token) {
    throw new Error(response.error_description ?? response.error ?? "Project token response did not include an access token");
  }

  const previousRefreshToken = store.accounts[account]?.projects?.[tenantId]?.refreshToken;
  const previousRefreshTokenExpiresAt = store.accounts[account]?.projects?.[tenantId]?.refreshTokenExpiresAt;
  const refreshToken = response.refresh_token ?? previousRefreshToken;

  const tokenSet: TokenSet = {
    accessToken: response.access_token,
    expiresAt: expiresAtFromJwtFirst(response, response.access_token),
    refreshToken,
    refreshTokenExpiresAt: response.refresh_token
      ? refreshExpiresAtFromToken(response, response.refresh_token)
      : previousRefreshTokenExpiresAt,
    scope: response.scope,
    tokenType: response.token_type ?? "Bearer"
  };

  return {
    config: {
      ...config,
      selectedProject: {
        ...config.selectedProject,
        tenantId
      }
    },
    store: {
      accounts: {
        ...store.accounts,
        [account]: {
          ...(store.accounts[account] ?? {}),
          projects: {
            ...(store.accounts[account]?.projects ?? {}),
            [tenantId]: tokenSet
          }
        }
      }
    }
  };
}
