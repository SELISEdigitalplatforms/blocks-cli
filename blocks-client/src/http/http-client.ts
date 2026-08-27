import { BlocksAuthenticationClient } from "../auth/auth-client.js";
import { BlocksResolvedConfig } from "../client.js";
import { BlocksExternalRequestOptions, BlocksRequestOptions } from "../types.js";
import { BlocksApiError } from "./errors.js";

export class BlocksHttpClient {
  constructor(
    private readonly config: BlocksResolvedConfig,
    private readonly auth: BlocksAuthenticationClient,
    private readonly fetchImpl: typeof fetch = globalThis.fetch?.bind(globalThis)
  ) {
    if (!this.fetchImpl) throw new Error("Blocks client requires fetch.");
  }

  async request<T>(path: string, options: BlocksRequestOptions = {}): Promise<T> {
    const url = buildUrl(this.config.apiUrl, path, options.query);
    const rawBody = isBodyInit(options.body) ? options.body : undefined;

    const send = async (accessTokenOverride?: string): Promise<Response> => {
      const headers = new Headers(options.headers);
      headers.set("Accept", "application/json");
      headers.set("x-blocks-key", this.config.xBlocksKey);

      if (options.body !== undefined && !rawBody && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      if (options.auth !== false) {
        const token = accessTokenOverride ?? options.accessToken ?? await this.auth.accessToken();
        if (token) headers.set("Authorization", `Bearer ${token}`);
      }

      return this.fetchImpl(url, {
        body: rawBody ?? (options.body === undefined ? undefined : JSON.stringify(options.body)),
        // IAM's hosted IdP flow sets the session as a Secure, httpOnly cookie by default;
        // without this the browser never sends it back on subsequent Blocks API calls.
        credentials: "include",
        headers,
        method: options.method ?? (options.body === undefined ? "GET" : "POST")
      });
    };

    let response = await send();

    // A 401 on a token the caller supplied directly (options.accessToken) is the
    // caller's problem to resolve, not ours. Otherwise, give the app one chance to
    // recover through its own onUnauthorized hook (expected to dedupe concurrent
    // callers behind a single refresh) and retry exactly once with what it returns.
    if (response.status === 401 && options.auth !== false && options.accessToken === undefined && this.config.onUnauthorized) {
      const freshToken = await this.config.onUnauthorized();
      if (freshToken) response = await send(freshToken);
    }

    const body = await parseBody(response);
    if (!response.ok) throw new BlocksApiError(response.status, response.statusText, body);
    return body as T;
  }

  async external<T = unknown>(url: string, options: BlocksExternalRequestOptions = {}): Promise<T> {
    const response = await this.fetchImpl(url, {
      body: options.body,
      headers: options.headers,
      method: options.method ?? "GET"
    });

    const body = await parseBody(response);
    if (!response.ok) throw new BlocksApiError(response.status, response.statusText, body);
    return body as T;
  }
}

/**
 * `request` attaches the caller's bearer token, `x-blocks-key`, and
 * `credentials: "include"`, so it must only ever reach the configured Blocks
 * API. An absolute URL is still accepted -- callers legitimately pass a full
 * API URL -- but one pointing somewhere else would hand a live session to a
 * third party, so it is refused with a pointer to `external`, which sends no
 * Blocks credentials by design.
 */
function sameOriginOnly(path: string, baseUrl: string): URL {
  const target = new URL(path);
  const base = new URL(`${baseUrl}/`);
  if (target.origin !== base.origin) {
    throw new Error(
      `Refusing to send Blocks credentials to ${target.origin}: it is not the configured apiUrl (${base.origin}). `
      + "Use blocks.http.external(url) for third-party URLs such as a pre-signed storage upload."
    );
  }

  return target;
}

function isBodyInit(value: unknown): value is BodyInit {
  return typeof Blob !== "undefined" && value instanceof Blob
    || typeof FormData !== "undefined" && value instanceof FormData
    || typeof URLSearchParams !== "undefined" && value instanceof URLSearchParams
    || typeof ReadableStream !== "undefined" && value instanceof ReadableStream
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value);
}

function buildUrl(baseUrl: string, path: string, query?: BlocksRequestOptions["query"]): string {
  const url = /^https?:\/\//i.test(path)
    ? sameOriginOnly(path, baseUrl)
    : new URL(path.replace(/^\/+/, ""), `${baseUrl}/`);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const text = await response.text();
  if (!text) return undefined;

  // Parsing is best-effort for every content type, including a declared
  // application/json. A proxy, WAF, or load balancer in front of the API can
  // answer with an HTML error page while still claiming JSON; throwing a raw
  // SyntaxError there would lose the HTTP status entirely and break the
  // documented contract that a non-2xx response always surfaces as a
  // BlocksApiError. Returning the raw text keeps the status and hands the
  // caller the body it actually got.
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
