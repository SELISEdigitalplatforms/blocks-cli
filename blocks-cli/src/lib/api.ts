import { getAccountSession, getImpersonatedProjectSession } from "./auth.js";
import { readConfig, resolveAccountProfile } from "./config.js";
import { redactSecrets } from "./redact.js";

type RequestOptions = {
  acceptFailureEnvelope?: boolean;
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
  const { name: accountName, profile } = await resolveAccountProfile(config, options.accountName);
  const baseUrl = options.apiUrl ?? profile.apiUrl;
  warnOnRedirectedApiUrl(profile.apiUrl, options.apiUrl);
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
      const account = await getAccountSession(accountName, { forceRefresh });
      headers.Authorization = `Bearer ${account.accessToken}`;
      headers["x-blocks-key"] = account.accountTenant;
    }

    if (options.impersonatedProjectAuth) {
      const project = await getImpersonatedProjectSession(accountName, options.projectTenantId, { forceRefresh });
      headers.Authorization = `Bearer ${project.accessToken}`;
      // The impersonated token is minted and signed by the root tenant's IdP --
      // its JWKS only exists under the root tenant, so signature validation
      // needs x-blocks-key pointed at root, not the target project. The actual
      // tenant-data scoping comes from a claim already inside the validated
      // token, not from this header.
      headers["x-blocks-key"] = project.accountTenant;
    }

    if (options.preferImpersonatedProjectAuth) {
      const tenantId = options.projectTenantId;
      if (tenantId) {
        const project = await getImpersonatedProjectSession(accountName, tenantId, { forceRefresh });
        headers.Authorization = `Bearer ${project.accessToken}`;
        headers["x-blocks-key"] = project.accountTenant;
      } else {
        const account = await getAccountSession(accountName, { forceRefresh });
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

  if (!options.acceptFailureEnvelope && isFailureEnvelope(data)) {
    throw new Error(`Blocks API returned an unsuccessful response${errorDetail(data)}`);
  }

  return data as T;
}

function buildUrl(baseUrl: string, path: string): URL {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  if (/^https?:\/\//i.test(path)) {
    // Every caller passes a literal Blocks path today, and this branch exists
    // only so a fully-qualified API URL also works. Pinning it to the resolved
    // base origin keeps it that way: `blocksRequest` attaches the account or
    // project bearer token plus x-blocks-key, so a path that ever came from a
    // server response could otherwise hand a live session to another host.
    const target = new URL(path);
    const base = new URL(normalizedBase);
    if (target.origin !== base.origin) {
      throw new Error(
        `Refusing to send Blocks credentials to ${target.origin}: it is not the resolved API origin (${base.origin}).`
      );
    }

    return target;
  }

  const normalizedPath = path.replace(/^\/+/, "");
  return new URL(normalizedPath, normalizedBase);
}

const warnedApiOrigins = new Set<string>();

/**
 * Says out loud when `--api-url` points somewhere other than the account's
 * configured API. The override is a deliberate feature (local gateways, staging
 * environments), but the request still carries this account's bearer token, so a
 * command copied from somewhere with a host swapped in would hand a live session
 * to that host without any visible sign. One line per distinct origin.
 */
function warnOnRedirectedApiUrl(profileApiUrl: string, override?: string): void {
  if (!override) return;

  try {
    const target = new URL(override);
    const configured = new URL(profileApiUrl);
    if (target.origin === configured.origin || warnedApiOrigins.has(target.origin)) return;

    warnedApiOrigins.add(target.origin);
    console.error(
      `Warning: --api-url sends this account's token to ${target.origin} instead of ${configured.origin}.`
    );
  } catch {
    // An unparseable override fails later on its own, with a better message.
  }
}

const MAX_ERROR_DETAIL = 800;

function errorDetail(data: unknown): string {
  if (!data) return "";
  if (typeof data === "string") return `: ${truncate(data)}`;
  if (typeof data !== "object") return `: ${String(data)}`;

  const record = data as Record<string, unknown>;
  for (const key of ["detail", "message", "error_description", "error", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value) {
      // The headline string is often the only human-readable part but rarely the
      // actionable one: ASP.NET ProblemDetails always reports `title` as the
      // generic "One or more validation errors occurred." and puts the field that
      // actually failed in a sibling `errors` object. Returning on `title` alone
      // hid which field was rejected on every 400 the API produces.
      const fields = fieldErrorDetail(record.errors);
      return `: ${truncate(fields ? `${value} ${fields}` : value)}`;
    }
  }

  // Last-resort dump of an error envelope with no recognized message field.
  // Some services echo the submitted request back inside the error, so this
  // runs through the same redaction the dry-run output uses -- an error message
  // is printed to stderr and pasted into issues just as readily as a dry-run.
  return `: ${truncate(JSON.stringify(redactSecrets(data)))}`;
}

/**
 * Renders the field-level half of an error body. Three shapes reach this:
 * ProblemDetails (`{"Filter.Search": ["The Search field is required."]}`), the
 * Blocks failure envelope (`{"invalid_request": "At least one role is required."}`),
 * and FluentValidation arrays (`[{propertyName, errorMessage}]`). Redacted, because
 * services echo submitted values back inside validation errors.
 */
function fieldErrorDetail(errors: unknown): string {
  if (!errors || typeof errors !== "object") return "";
  const safe = redactSecrets(errors) as Record<string, unknown> | unknown[];

  const parts: string[] = [];
  if (Array.isArray(safe)) {
    for (const entry of safe) {
      if (!entry || typeof entry !== "object") continue;
      const { errorMessage, propertyName } = entry as Record<string, unknown>;
      if (typeof errorMessage !== "string") continue;
      parts.push(typeof propertyName === "string" && propertyName ? `${propertyName}: ${errorMessage}` : errorMessage);
    }
  } else {
    for (const [field, value] of Object.entries(safe)) {
      const messages = Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
      if (messages.length) parts.push(`${field}: ${messages.join(" ")}`);
      else if (typeof value === "string" && value) parts.push(`${field}: ${value}`);
    }
  }

  return parts.length ? `(${parts.join("; ")})` : "";
}

function truncate(value: string): string {
  return value.length > MAX_ERROR_DETAIL ? `${value.slice(0, MAX_ERROR_DETAIL)}... (truncated)` : value;
}

function looksLikeHtml(text: string): boolean {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
}

function isFailureEnvelope(data: unknown): data is Record<string, unknown> {
  return typeof data === "object"
    && data !== null
    && !Array.isArray(data)
    && (data as Record<string, unknown>).isSuccess === false;
}

function parseJson(text: string): unknown {
  if (!text) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
