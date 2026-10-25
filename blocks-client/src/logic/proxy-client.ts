import { BlocksHttpClient } from "../http/http-client.js";
import { trimSlashes } from "./route.js";
import { BlocksProxyRequestOptions } from "./types.js";

/** A proxy's public gateway route; configuring proxies is CLI work (`blocks logic proxy *`). */
const PROXY_GATEWAY_API = "/logic/v4/proxy/gateway";

/**
 * Calling a third-party API through a Blocks proxy, so the upstream URL and its
 * credentials stay server-side.
 */
export class BlocksProxyClient {
  constructor(
    private readonly http: BlocksHttpClient,
    private readonly apiUrl: string
  ) {}

  /**
   * What: the absolute gateway URL of a proxy route.
   * Why: other backends and tools call the proxy directly.
   * How: callers send this project's `x-blocks-key`, plus a Blocks bearer token unless the proxy is Public.
   */
  url(slug: string, path?: string): string {
    return `${this.apiUrl}${routeOf(slug, path)}`;
  }

  /**
   * What: calls the upstream through the proxy and returns the parsed response body.
   * Why: app code reaches a third-party API without holding its URL or keys.
   * How: `method` (default GET) must be one the proxy allows and `path` must match a declared route.
   * Non-2xx -- the upstream's own errors, and gateway refusals with `PROXY_GATEWAY_<OUTCOME>` codes
   * (401 no/invalid token, 403 access rules or undeclared route, 404 unknown or disabled proxy, 405
   * method not allowed, 413 body over 1 MB, 422 body not mergeable, 429 rate limit with
   * `Retry-After`, 502/503/504 upstream failure/unavailable/timeout) -- throws `BlocksApiError`.
   */
  request<T = unknown>(slug: string, options: BlocksProxyRequestOptions = {}): Promise<T> {
    return this.http.request<T>(routeOf(slug, options.path), {
      auth: options.auth,
      body: options.body,
      headers: options.headers,
      method: options.method ?? "GET",
      query: options.query,
      signal: options.signal
    });
  }

  /**
   * What: the same call, returning the unread `Response`.
   * Why: for non-JSON upstream bodies (files, streams) or when headers such as `Retry-After` matter.
   * How: never throws on a non-2xx status -- check `response.ok`.
   */
  requestRaw(slug: string, options: BlocksProxyRequestOptions = {}): Promise<Response> {
    return this.http.send(routeOf(slug, options.path), {
      auth: options.auth,
      body: options.body,
      headers: options.headers,
      method: options.method ?? "GET",
      query: options.query,
      signal: options.signal
    });
  }
}

function routeOf(slug: string, path?: string): string {
  if (!slug) throw new Error("A proxy slug is required.");
  const suffix = trimSlashes(path ?? "");
  const root = `${PROXY_GATEWAY_API}/${encodeURIComponent(slug)}`;
  return suffix ? `${root}/${suffix}` : root;
}
