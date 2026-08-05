import { getAccountSession, getImpersonatedProjectSession } from "./auth.js";
import { getAccountProfile, readConfig } from "./config.js";

type RequestOptions = {
  accountAuth?: boolean;
  accountName?: string;
  apiUrl?: string;
  body?: unknown;
  impersonatedProjectAuth?: boolean;
  method?: string;
  // Uses the impersonated project session when a project is currently
  // selected, falling back to the account session otherwise. For endpoints
  // that are safe to call either way (the server rebuilds permission checks
  // against the root tenant while impersonating).
  preferImpersonatedProjectAuth?: boolean;
  projectTenantId?: string;
  query?: Record<string, string | number | boolean | string[] | undefined>;
};

export async function blocksRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const config = await readConfig();
  const { profile } = getAccountProfile(config, options.accountName);
  const baseUrl = options.apiUrl ?? profile.apiUrl;
  const url = buildUrl(baseUrl, path);

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) url.searchParams.append(key, item);
      continue;
    }
    url.searchParams.set(key, String(value));
  }

  const isFormData = options.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    Accept: "application/json"
  };
  if (options.body !== undefined && !isFormData) baseHeaders["Content-Type"] = "application/json";

  const send = async (forceRefresh: boolean): Promise<Response> => {
    const headers: Record<string, string> = { ...baseHeaders };

    if (options.accountAuth) {
      const account = await getAccountSession(options.accountName, { forceRefresh });
      headers.Authorization = `Bearer ${account.accessToken}`;
      headers["x-blocks-key"] = account.accountTenant;
    }

    if (options.impersonatedProjectAuth) {
      const project = await getImpersonatedProjectSession(options.accountName, options.projectTenantId, { forceRefresh });
      headers.Authorization = `Bearer ${project.accessToken}`;
      // The impersonated token is minted and signed by the root tenant's IdP --
      // its JWKS only exists under the root tenant, so signature validation
      // needs x-blocks-key pointed at root, not the target project. The actual
      // tenant-data scoping comes from a claim already inside the validated
      // token, not from this header.
      headers["x-blocks-key"] = project.accountTenant;
    }

    if (options.preferImpersonatedProjectAuth) {
      const tenantId = options.projectTenantId ?? config.selectedProject?.tenantId;
      if (tenantId) {
        const project = await getImpersonatedProjectSession(options.accountName, tenantId, { forceRefresh });
        headers.Authorization = `Bearer ${project.accessToken}`;
        headers["x-blocks-key"] = project.accountTenant;
      } else {
        const account = await getAccountSession(options.accountName, { forceRefresh });
        headers.Authorization = `Bearer ${account.accessToken}`;
        headers["x-blocks-key"] = account.accountTenant;
      }
    }

    return fetch(url, {
      body: options.body === undefined ? undefined : isFormData ? (options.body as FormData) : JSON.stringify(options.body),
      headers,
      method: options.method ?? (options.body === undefined ? "GET" : "POST")
    }).catch((error: Error) => {
      throw new Error(`Blocks API request failed for ${url.origin}${url.pathname}: ${error.message}`);
    });
  };

  const method = options.method ?? (options.body === undefined ? "GET" : "POST");

  let response = await send(false);
  if (response.status === 401 && (options.accountAuth || options.impersonatedProjectAuth || options.preferImpersonatedProjectAuth)) {
    // The locally cached expiry said the token was still good, but the server
    // rejected it anyway (early revocation, clock skew, forced logout server-side).
    // Force one refresh-and-retry before giving up -- this is what actually
    // prevents a spurious 're-run blocks login' when the refresh token is still valid.
    response = await send(true);
  } else if (response.status === 500 && method === "GET") {
    // Some tenant-scoped read endpoints (mfa config, signup-settings) intermittently
    // 500 with a JWKS/kid lookup failure right after impersonation, then succeed on
    // an immediate identical retry once the signing-key cache catches up. Safe to
    // retry blindly here because GET is idempotent.
    response = await send(false);
  }

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    const detail = errorDetail(data);
    throw new Error(`Blocks API ${response.status} ${response.statusText}${detail}`);
  }

  if (typeof data === "string" && looksLikeHtml(data)) {
    throw new Error(`Blocks API returned HTML for ${url.pathname}. Check the command endpoint path.`);
  }

  return data as T;
}

function buildUrl(baseUrl: string, path: string): URL {
  if (/^https?:\/\//i.test(path)) return new URL(path);
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBase);
}

function errorDetail(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return `: ${data}`;
  if (typeof data !== "object") return `: ${String(data)}`;

  const record = data as Record<string, unknown>;
  for (const key of ["detail", "message", "error_description", "error", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value) return `: ${value}`;
  }

  return `: ${JSON.stringify(data)}`;
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
}

function parseJson(text: string): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
