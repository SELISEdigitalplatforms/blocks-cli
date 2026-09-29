import { readFile } from "node:fs/promises";
import { booleanFlag, integerFlag, stringFlag } from "./args.js";
import { blocksRequest } from "./api.js";
import { isRecord } from "./data-response.js";
import { CliActionableError } from "./errors.js";
import { unwrapData } from "./merge-current.js";
import { requestContext } from "./request-context.js";

export const LOGIC_PROXIES_API = "/logic/v4/Proxies";

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

type Flags = Record<string, string | boolean>;

export type ProxyRequestContext = {
  projectKey: string;
  flags: Flags;
};

function apiCtx(options: ProxyRequestContext) {
  return {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/** Absolute https:// URL check for Mode A --upstream. */
export function assertAbsoluteHttpsUrl(raw: string | undefined, label = "upstream"): string {
  if (!raw || !raw.trim()) {
    throw new CliActionableError(
      `Provide --${label} with an absolute https:// URL.`,
      "proxy_invalid_upstream"
    );
  }
  const value = raw.trim();
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new CliActionableError(
      `'${value}' is not an absolute https:// URL.`,
      "proxy_invalid_upstream"
    );
  }
  if (parsed.protocol !== "https:") {
    throw new CliActionableError(
      `'${value}' is not an absolute https:// URL.`,
      "proxy_invalid_upstream"
    );
  }
  return value;
}

/** Parse Mode A --methods CSV into 1–5 of GET/POST/PUT/PATCH/DELETE. */
export function parseProxyMethods(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) {
    throw new CliActionableError(
      "Provide --methods as a comma-separated list of GET,POST,PUT,PATCH,DELETE.",
      "proxy_invalid_methods"
    );
  }
  const methods = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
  if (methods.length < 1 || methods.length > 5) {
    throw new CliActionableError(
      "Provide --methods as a comma-separated list of 1–5 of GET,POST,PUT,PATCH,DELETE.",
      "proxy_invalid_methods"
    );
  }
  const seen = new Set<string>();
  for (const method of methods) {
    if (!ALLOWED_METHODS.has(method)) {
      throw new CliActionableError(
        `'${method}' is not a valid proxy method. Allowed: GET,POST,PUT,PATCH,DELETE.`,
        "proxy_invalid_methods"
      );
    }
    if (seen.has(method)) {
      throw new CliActionableError(
        `Duplicate method '${method}' in --methods.`,
        "proxy_invalid_methods"
      );
    }
    seen.add(method);
  }
  return methods;
}

const MODE_A_CREATE_FLAGS = ["name", "upstream", "methods", "enabled", "disabled"] as const;
const MODE_A_UPDATE_FLAGS = ["name", "upstream", "methods"] as const;

/**
 * Mode A flags and --file are mutually exclusive. Returns which mode is active
 * and whether any Mode A flag was passed (so update can require at least one).
 */
export function resolveProxyWriteMode(
  flags: Flags,
  kind: "create" | "update"
): { mode: "file" | "simple"; hasSimple: boolean; filePath?: string } {
  const filePath = stringFlag(flags, "file") || undefined;
  const simpleKeys = kind === "create" ? MODE_A_CREATE_FLAGS : MODE_A_UPDATE_FLAGS;
  const hasSimple = simpleKeys.some((key) => {
    if (key === "enabled" || key === "disabled") return booleanFlag(flags, key) || flags[key] === false;
    return typeof flags[key] === "string" && String(flags[key]).length > 0;
  });

  if (filePath && hasSimple) {
    throw new CliActionableError(
      "Pass either Mode A flags (--name/--upstream/--methods) or --file, not both.",
      "proxy_mode_conflict",
      "Pick one: simple flags for the common case, or --file with a full ProxyCreateRequestDto / replacement body."
    );
  }
  if (filePath) return { mode: "file", hasSimple: false, filePath };
  return { mode: "simple", hasSimple };
}

export async function readProxyFileBody(filePath: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(`Cannot read --file ${filePath}: ${message}`, "proxy_file_unreadable");
  }
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(`--file ${filePath} is not valid JSON: ${message}`, "proxy_file_invalid");
  }
  if (!isRecord(parsed)) {
    throw new CliActionableError(`--file ${filePath} must contain a JSON object.`, "proxy_file_invalid");
  }
  return parsed;
}

/** Map upstream Proxies error envelopes onto the ticket's CLI codes. */
export function throwProxyUpstreamError(data: unknown, fallbackMessage: string): never {
  const record = isRecord(data) ? data : {};
  const nested = isRecord(record.data) ? record.data : undefined;
  const source = { ...record, ...(nested ?? {}) };

  const code =
    readString(source, "code", "Code", "errorCode", "ErrorCode", "reason", "Reason") ??
    readString(record, "code", "Code");

  const message =
    readString(source, "message", "Message", "description", "Description", "detail", "Detail", "title", "Title") ??
    fallbackMessage;

  const errors = source.errors ?? record.errors;

  const verbatimCodes = new Set([
    "PROXY_SLUG_CONFLICT",
    "PROXY_VALIDATION",
    "PROXY_NOT_FOUND",
    "PROXY_VERSION_NOT_FOUND",
    "PROXY_DELETED",
    "PROXY_REVERT_CONFLICT",
    "PROXY_VERSION_NOT_REVERTABLE"
  ]);
  if (code && verbatimCodes.has(code)) {
    // Ticket surfaces PROXY_NOT_FOUND verbatim for Phase 2; Phase 1 also accepts proxy_not_found.
    const outCode = code === "PROXY_NOT_FOUND" ? "PROXY_NOT_FOUND" : code;
    throw new CliActionableError(message, outCode, undefined, errors);
  }
  if (/slug.?conflict/i.test(message)) {
    throw new CliActionableError(message, "PROXY_SLUG_CONFLICT");
  }
  if (/not found/i.test(message)) {
    throw new CliActionableError(message, "PROXY_NOT_FOUND");
  }
  if (errors !== undefined) {
    throw new CliActionableError(message, "PROXY_VALIDATION", undefined, errors);
  }
  throw new CliActionableError(message, code ?? "proxy_request_failed");
}

function ensureHttpOkOrMap(error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  // blocksRequest throws "Blocks API <status> ..." with optional JSON detail.
  const jsonMatch = message.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (jsonMatch) {
    try {
      throwProxyUpstreamError(JSON.parse(jsonMatch[1]), message);
    } catch (inner) {
      if (inner instanceof CliActionableError) throw inner;
    }
  }
  if (/\b404\b/.test(message) || /not found/i.test(message)) {
    throw new CliActionableError(message, "proxy_not_found");
  }
  // 409 / slug messages lose the structured code in errorDetail — recover it.
  if (
    /PROXY_SLUG_CONFLICT/i.test(message)
    || /slug.?conflict/i.test(message)
    || (/\b409\b/.test(message) && /slug/i.test(message))
    || (/already exists/i.test(message) && /slug/i.test(message))
  ) {
    throw new CliActionableError(message, "PROXY_SLUG_CONFLICT");
  }
  if (/PROXY_VALIDATION/i.test(message)) {
    throw new CliActionableError(message, "PROXY_VALIDATION");
  }
  throw new CliActionableError(message, "proxy_request_failed");
}

export async function listProxies(options: ProxyRequestContext & {
  search?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
}): Promise<unknown> {
  const query: Record<string, string | number | boolean | undefined> = {
    Search: options.search,
    search: options.search,
    Page: options.page,
    page: options.page,
    PageNumber: options.page,
    pageNumber: options.page,
    PageSize: options.pageSize,
    pageSize: options.pageSize
  };
  if (options.isActive !== undefined) {
    query.IsActive = options.isActive;
    query.isActive = options.isActive;
  }
  return blocksRequest<unknown>(LOGIC_PROXIES_API, {
    ...apiCtx(options),
    method: "GET",
    query
  });
}

export async function getProxy(options: ProxyRequestContext & { proxyId: string }): Promise<unknown> {
  try {
    return await blocksRequest<unknown>(`${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}`, {
      ...apiCtx(options),
      method: "GET"
    });
  } catch (error) {
    // Spec: unknown/foreign id returns 200 with data:null — not an error.
    // A true 404 is still mapped for callers that need not-found (update/toggle/delete).
    ensureHttpOkOrMap(error);
  }
}

/** Returns the detail record, or null when the API answered data:null / empty. */
export function unwrapProxyDetail(response: unknown): Record<string, unknown> | null {
  if (response == null) return null;
  if (!isRecord(response)) return null;
  if (response.data === null) return null;
  if (isRecord(response.data)) return response.data;
  // Some deployments return the detail at the top level.
  if ("itemId" in response || "ItemId" in response || "slug" in response || "Slug" in response) {
    return response;
  }
  return null;
}

export async function createProxy(options: ProxyRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(LOGIC_PROXIES_API, {
      ...apiCtx(options),
      method: "POST",
      body: options.body
    });
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Proxy create failed.");
  }

  const itemId =
    readString(result ?? {}, "itemId", "ItemId") ??
    (isRecord(result?.data) ? readString(result.data as Record<string, unknown>, "itemId", "ItemId") : undefined);

  if (!itemId) {
    throw new CliActionableError(
      `Proxy create did not return an itemId: ${JSON.stringify(result)}`,
      "proxy_request_failed"
    );
  }

  const detailResponse = await getProxy({ ...options, proxyId: itemId });
  const detail = unwrapProxyDetail(detailResponse);
  if (!detail) {
    // Fall back to a minimal shape if follow-up Get is empty (should be rare).
    return { itemId, ...(isRecord(result) ? result : {}) };
  }
  return detail;
}

/**
 * Fields the PUT body may carry. Enabled and Slug are excluded — Enabled is
 * PATCH-only; Slug is server-derived and immutable.
 */
const UPDATE_CARRY_KEYS = [
  "name",
  "Name",
  "upstream",
  "Upstream",
  "methods",
  "Methods",
  "headers",
  "Headers",
  "query",
  "Query",
  "bodyMerge",
  "BodyMerge",
  "routes",
  "Routes",
  "responseMode",
  "ResponseMode",
  "responseInclude",
  "ResponseInclude",
  "access",
  "Access",
  "methodConfigs",
  "MethodConfigs"
] as const;

export function buildUpdateBodyFromCurrent(
  current: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const key of UPDATE_CARRY_KEYS) {
    if (current[key] !== undefined) body[key] = current[key];
  }
  // Prefer canonical camelCase when both casings exist on the current record.
  const prefer = [
    "name",
    "upstream",
    "methods",
    "headers",
    "query",
    "bodyMerge",
    "routes",
    "responseMode",
    "responseInclude",
    "access",
    "methodConfigs"
  ] as const;
  for (const key of prefer) {
    const pascal = key[0].toUpperCase() + key.slice(1);
    if (body[key] !== undefined && body[pascal] !== undefined) delete body[pascal];
  }
  return { ...body, ...overrides };
}

export async function updateProxy(options: ProxyRequestContext & {
  proxyId: string;
  overrides: Record<string, unknown>;
  /** When true, overrides replace the whole body (Mode B file) instead of merging. */
  replace?: boolean;
}): Promise<Record<string, unknown>> {
  const currentResponse = await getProxy({ ...options, proxyId: options.proxyId });
  const current = unwrapProxyDetail(currentResponse);
  if (!current) {
    throw new CliActionableError(
      `No proxy with id '${options.proxyId}'.`,
      "proxy_not_found"
    );
  }

  // Strip Enabled/Slug from overrides even if a Mode B file included them.
  const cleaned = { ...options.overrides };
  delete cleaned.enabled;
  delete cleaned.Enabled;
  delete cleaned.slug;
  delete cleaned.Slug;
  delete cleaned.itemId;
  delete cleaned.ItemId;

  const body = options.replace
    ? { ...cleaned }
    : buildUpdateBodyFromCurrent(current, cleaned);

  // Always identify the target.
  body.itemId = options.proxyId;
  body.ItemId = options.proxyId;

  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}`,
      {
        ...apiCtx(options),
        method: "PUT",
        body
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Proxy update failed.");
  }

  const detailResponse = await getProxy({ ...options, proxyId: options.proxyId });
  const detail = unwrapProxyDetail(detailResponse);
  return detail ?? { itemId: options.proxyId, ...unwrapData(result) };
}

export async function toggleProxy(options: ProxyRequestContext & {
  proxyId: string;
  enabled: boolean;
}): Promise<{ itemId: string; enabled: boolean }> {
  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}`,
      {
        ...apiCtx(options),
        method: "PATCH",
        body: {
          ItemId: options.proxyId,
          itemId: options.proxyId,
          Enabled: options.enabled,
          enabled: options.enabled
        }
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    const code = readString(result, "code", "Code", "reason", "Reason");
    if (code === "PROXY_NOT_FOUND" || /not found/i.test(JSON.stringify(result))) {
      throw new CliActionableError(
        `No proxy with id '${options.proxyId}'.`,
        "proxy_not_found"
      );
    }
    throwProxyUpstreamError(result, `Failed to ${options.enabled ? "enable" : "disable"} proxy.`);
  }

  return { itemId: options.proxyId, enabled: options.enabled };
}

export async function deleteProxy(options: ProxyRequestContext & { proxyId: string }): Promise<{ itemId: string; deleted: true }> {
  let result: Record<string, unknown> | undefined;
  try {
    result = await blocksRequest<Record<string, unknown>>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}`,
      {
        ...apiCtx(options),
        method: "DELETE"
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    const code = readString(result, "code", "Code", "reason", "Reason");
    if (code === "PROXY_NOT_FOUND" || /not found/i.test(JSON.stringify(result))) {
      throw new CliActionableError(
        `No proxy with id '${options.proxyId}'.`,
        "proxy_not_found"
      );
    }
    throwProxyUpstreamError(result, "Proxy delete failed.");
  }

  return { itemId: options.proxyId, deleted: true };
}

/** List pagination: ticket says --page is 0-based default 0, page-size 1–200 default 20. */
export function parseProxyListPaging(flags: Flags): { page: number; pageSize: number } {
  const page = integerFlag(flags, "page", 0);
  if (page < 0) throw new Error("--page must be greater than or equal to 0");
  const pageSize = integerFlag(flags, "page-size", 20);
  if (pageSize < 1 || pageSize > 200) {
    throw new Error("--page-size must be between 1 and 200");
  }
  return { page, pageSize };
}

export function parseProxyListActiveFilter(flags: Flags): boolean | undefined {
  const active = booleanFlag(flags, "active");
  const inactive = booleanFlag(flags, "inactive");
  if (active && inactive) {
    throw new CliActionableError(
      "Pass --active or --inactive, not both.",
      "proxy_filter_conflict"
    );
  }
  if (active) return true;
  if (inactive) return false;
  return undefined;
}

/** Build Mode A create body from flags (after mode resolution). */
export function buildSimpleCreateBody(flags: Flags): Record<string, unknown> {
  const name = stringFlag(flags, "name");
  if (!name || !name.trim()) {
    throw new CliActionableError(
      "Provide --name for the proxy.",
      "proxy_name_required"
    );
  }
  const upstream = assertAbsoluteHttpsUrl(stringFlag(flags, "upstream") || undefined);
  const methods = parseProxyMethods(stringFlag(flags, "methods") || undefined);
  const disabled = booleanFlag(flags, "disabled");
  const enabledFlag = booleanFlag(flags, "enabled");
  // Default enabled. --disabled wins if both somehow appear.
  const enabled = disabled ? false : enabledFlag ? true : true;
  return { name: name.trim(), upstream, methods, enabled };
}

/** Build Mode A update overrides from flags (subset). */
export function buildSimpleUpdateOverrides(flags: Flags): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const name = stringFlag(flags, "name");
  if (name) overrides.name = name.trim();
  const upstreamRaw = stringFlag(flags, "upstream");
  if (upstreamRaw) overrides.upstream = assertAbsoluteHttpsUrl(upstreamRaw);
  const methodsRaw = stringFlag(flags, "methods");
  if (methodsRaw) overrides.methods = parseProxyMethods(methodsRaw);
  if (Object.keys(overrides).length === 0) {
    throw new CliActionableError(
      "Provide at least one of --name, --upstream, --methods, or --file.",
      "proxy_update_empty"
    );
  }
  return overrides;
}


/* ─── Phase 2: versions / revert / test / executions / overview ─── */

export async function listProxyVersions(options: ProxyRequestContext & {
  proxyId: string;
  page: number;
  pageSize: number;
}): Promise<unknown> {
  let result: unknown;
  try {
    result = await blocksRequest<unknown>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}/versions`,
      {
        ...apiCtx(options),
        method: "GET",
        query: {
          Page: options.page,
          page: options.page,
          PageNumber: options.page,
          pageNumber: options.page,
          PageSize: options.pageSize,
          pageSize: options.pageSize
        }
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }
  if (isRecord(result) && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Failed to list proxy versions.");
  }
  return result;
}

export async function revertProxyVersion(options: ProxyRequestContext & {
  proxyId: string;
  versionId: string;
}): Promise<{ itemId: string; revertedTo: string }> {
  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}/versions/${encodeURIComponent(options.versionId)}/revert`,
      {
        ...apiCtx(options),
        method: "POST",
        body: {}
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Proxy revert failed.");
  }

  return { itemId: options.proxyId, revertedTo: options.versionId };
}

export async function testProxy(options: ProxyRequestContext & {
  body: Record<string, unknown>;
}): Promise<unknown> {
  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(`${LOGIC_PROXIES_API}/test`, {
      ...apiCtx(options),
      method: "POST",
      body: options.body
    });
  } catch (error) {
    ensureHttpOkOrMap(error);
  }

  if (result && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Proxy test failed.");
  }
  return result;
}

export async function listProxyExecutions(options: ProxyRequestContext & {
  proxyId: string;
  statusClass?: string;
  afterId?: string;
  page: number;
  pageSize: number;
  asOf?: string;
}): Promise<unknown> {
  const query: Record<string, string | number | boolean | undefined> = {
    PageSize: options.pageSize,
    pageSize: options.pageSize,
    StatusClass: options.statusClass,
    statusClass: options.statusClass
  };
  if (options.afterId) {
    query.AfterId = options.afterId;
    query.afterId = options.afterId;
  } else {
    query.Page = options.page;
    query.page = options.page;
    query.PageNumber = options.page;
    query.pageNumber = options.page;
  }
  if (options.asOf) {
    query.AsOfUtc = options.asOf;
    query.asOfUtc = options.asOf;
    query.AsOf = options.asOf;
    query.asOf = options.asOf;
  }
  let result: unknown;
  try {
    result = await blocksRequest<unknown>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}/executions`,
      {
        ...apiCtx(options),
        method: "GET",
        query
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }
  if (isRecord(result) && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Failed to list proxy executions.");
  }
  return result;
}

export async function getProxyExecution(options: ProxyRequestContext & {
  proxyId: string;
  executionId: string;
}): Promise<unknown> {
  try {
    return await blocksRequest<unknown>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}/executions/${encodeURIComponent(options.executionId)}`,
      {
        ...apiCtx(options),
        method: "GET"
      }
    );
  } catch (error) {
    // Spec: never a 404 — unknown/mismatch returns {data:null}. If the server
    // still 404s, surface as data:null rather than failing the command.
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message) || /not found/i.test(message)) {
      return { data: null };
    }
    ensureHttpOkOrMap(error);
  }
}

export async function getProxyOverview(options: ProxyRequestContext & { proxyId: string }): Promise<unknown> {
  let result: unknown;
  try {
    result = await blocksRequest<unknown>(
      `${LOGIC_PROXIES_API}/${encodeURIComponent(options.proxyId)}/overview`,
      {
        ...apiCtx(options),
        method: "GET"
      }
    );
  } catch (error) {
    ensureHttpOkOrMap(error);
  }
  if (isRecord(result) && result.isSuccess === false) {
    throwProxyUpstreamError(result, "Failed to load proxy overview.");
  }
  return result;
}

export function parseProxyPageSize(flags: Flags, defaultSize: number): number {
  const pageSize = integerFlag(flags, "page-size", defaultSize);
  if (pageSize < 1 || pageSize > 200) {
    throw new Error("--page-size must be between 1 and 200");
  }
  return pageSize;
}

export function parseZeroBasedPage(flags: Flags): number {
  const page = integerFlag(flags, "page", 0);
  if (page < 0) throw new Error("--page must be greater than or equal to 0");
  return page;
}
