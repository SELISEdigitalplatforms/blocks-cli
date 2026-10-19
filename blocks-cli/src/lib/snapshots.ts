import { blocksRequest } from "./api.js";
import type { SnapshotService } from "./blocks-folders.js";
import { LOGIC_PROXIES_API } from "./logic-proxy.js";
import { listSchedules } from "./logic-scheduler.js";
import { redactSecrets, SECRET_FIELD_NAMES } from "./redact.js";
import { listReleaseRepos, repoSummary } from "./release.js";
import { requestContext } from "./request-context.js";

type Flags = Record<string, string | boolean>;
type FetchContext = { projectKey: string; flags: Flags };

/**
 * `SECRET_FIELD_NAMES` leaves out `secretKey` on purpose (see redact.ts), but
 * Storage/Gets returns the raw StorageConfiguration entity, whose `secretKey` and
 * `sftpSecretKey` are the provider credentials themselves. Logic's proxy list
 * returns each proxy's raw `upstream` URL beside an `upstreamMasked` copy, and the
 * raw one can carry a credential in its query. A snapshot is a file that may get
 * committed, so all three are redacted for every service.
 */
const SNAPSHOT_EXTRA_SECRETS = ["secretKey", "sftpSecretKey", "upstream"];

// Upper bound on pages per list so a server that ignores paging can't loop forever.
const MAX_PAGES = 100;

/** One fetcher per snapshot file, keyed by the file name `blocks pull` writes. */
export const SNAPSHOT_FETCHERS: Record<SnapshotService, Record<string, (ctx: FetchContext) => Promise<unknown>>> = {
  iam: {
    "roles.json": (ctx) => collectPages(0, 100, (page, pageSize) => blocksRequest<unknown>("/iam/v4/iam/roles", {
      ...projectAuth(ctx),
      // Search is non-nullable server-side; "" means unfiltered (see iam roles list).
      body: { filter: { search: "" }, page, pageSize }
    })),
    "permissions.json": (ctx) => collectPages(0, 100, (page, pageSize) => blocksRequest<unknown>("/iam/v4/iam/permissions", {
      ...projectAuth(ctx),
      // Search and IsBuiltIn are non-nullable strings; "" means unfiltered (see iam permissions list).
      body: { filter: { isBuiltIn: "", search: "" }, page, pageSize }
    })),
    "resource-groups.json": (ctx) => blocksRequest<unknown>("/iam/v4/iam/resource-groups", projectAuth(ctx)),
    "features.json": (ctx) => blocksRequest<unknown>("/iam/v4/iam/resource/features", projectAuth(ctx))
  },
  auth: {
    "config.json": (ctx) => blocksRequest<unknown>("/iam/v4/auth/config", projectAuth(ctx)),
    "oidc-clients.json": (ctx) => blocksRequest<unknown>("/iam/v4/oidc-clients", projectAuth(ctx)),
    "identity-providers.json": (ctx) => blocksRequest<unknown>("/iam/v4/auth/identity-providers", projectAuth(ctx))
  },
  mail: {
    "configs.json": (ctx) => blocksRequest<unknown>("/os/v4/Mail/Gets", projectAuth(ctx)),
    // GetTemplates pages from 0 (the repository skips PageSize * PageNumber) and
    // answers { templates, totalCount }.
    "templates.json": (ctx) => collectPages(0, 100, (page, pageSize) => blocksRequest<unknown>("/os/v4/Mail/GetTemplates", {
      ...projectAuth(ctx),
      query: { PageNumber: page, PageSize: pageSize }
    }), "templates")
  },
  storage: {
    "configs.json": (ctx) => blocksRequest<unknown>("/os/v4/Storage/Gets", projectAuth(ctx))
  },
  release: {
    "repos.json": async (ctx) => (await listReleaseRepos(ctx.projectKey, ctx.flags)).map((repo) => repoSummary(repo))
  },
  logic: {
    "proxies.json": (ctx) => collectPages(0, 200, (page, pageSize) => blocksRequest<unknown>(LOGIC_PROXIES_API, {
      ...projectAuth(ctx),
      acceptFailureEnvelope: true,
      method: "GET",
      query: { Page: page, PageNumber: page, PageSize: pageSize, page, pageNumber: page, pageSize }
    })),
    "schedules.json": (ctx) => collectPages(0, 100, (page, pageSize) => listSchedules({ ...ctx, page, pageSize }))
  }
};

function projectAuth(ctx: FetchContext) {
  return {
    impersonatedProjectAuth: true as const,
    ...requestContext(ctx.flags),
    projectTenantId: ctx.projectKey
  };
}

/**
 * Pages through a list endpoint until a short page or the reported total, and
 * returns the items as one array. Blocks list endpoints answer in several shapes
 * (a bare array, `data`, `items`, `data.items`, or a named key such as
 * `templates`); a response with none of them is returned verbatim, since it
 * isn't a list this helper understands.
 */
export async function collectPages(
  firstPage: number,
  pageSize: number,
  fetchPage: (page: number, pageSize: number) => Promise<unknown>,
  itemKey?: string
): Promise<unknown> {
  const collected: unknown[] = [];
  for (let page = firstPage; page < firstPage + MAX_PAGES; page += 1) {
    const response = await fetchPage(page, pageSize);
    throwIfFailureEnvelope(response);
    const items = itemsOf(response, itemKey);
    if (!items) return page === firstPage ? response : collected;
    collected.push(...items);
    const total = totalOf(response);
    if (items.length < pageSize || (total !== undefined && collected.length >= total)) break;
  }
  return collected;
}

function itemsOf(response: unknown, itemKey?: string): unknown[] | undefined {
  if (Array.isArray(response)) return response;
  if (!isRecord(response)) return undefined;
  const keys = ["data", "Data", "items", "Items"];
  if (itemKey) keys.unshift(itemKey, itemKey[0].toUpperCase() + itemKey.slice(1));
  for (const key of keys) {
    const value = response[key];
    if (Array.isArray(value)) return value;
    if (isRecord(value)) {
      const nested = value.items ?? value.Items;
      if (Array.isArray(nested)) return nested;
    }
  }
  return undefined;
}

function totalOf(response: unknown): number | undefined {
  if (!isRecord(response)) return undefined;
  const sources = [response, isRecord(response.data) ? response.data : undefined];
  for (const source of sources) {
    const value = source?.totalCount ?? source?.TotalCount;
    if (typeof value === "number") return value;
  }
  return undefined;
}

function throwIfFailureEnvelope(response: unknown): void {
  if (!isRecord(response)) return;
  if (response.isSuccess === false || response.success === false) {
    const errors = response.errors ?? response.Errors ?? response.message;
    throw new Error(`Service returned a failure: ${JSON.stringify(errors ?? response)}`);
  }
}

/**
 * Redacts every secret-named field (see redact.ts, plus `secretKey`) and counts
 * how many non-empty values it hid, so `blocks pull` can say so.
 */
export function redactSnapshot(value: unknown): { value: unknown; redacted: number } {
  const names = new Set([...SECRET_FIELD_NAMES, ...SNAPSHOT_EXTRA_SECRETS].map((name) => name.toLowerCase()));
  return { redacted: countSecrets(value, names), value: redactSecrets(value, SNAPSHOT_EXTRA_SECRETS) };
}

function countSecrets(value: unknown, names: ReadonlySet<string>): number {
  if (Array.isArray(value)) return value.reduce<number>((sum, item) => sum + countSecrets(item, names), 0);
  if (!isRecord(value)) return 0;
  let count = 0;
  for (const [key, item] of Object.entries(value)) {
    if (names.has(key.toLowerCase())) {
      if (item !== null && item !== undefined && item !== "") count += 1;
    } else {
      count += countSecrets(item, names);
    }
  }
  return count;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
