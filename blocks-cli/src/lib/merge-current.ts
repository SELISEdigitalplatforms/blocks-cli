import { isRecord } from "./data-response.js";

/**
 * Several Blocks save/update endpoints bind the request onto a fresh DTO and then
 * assign every DTO field onto the stored document. A field the caller left out does
 * not mean "keep": it arrives as the C# default -- false, 0, "" or an empty list --
 * and overwrites what was stored. `iam permissions update`, `auth config save` and
 * `auth oidc-clients save` already read the current document and merge over it for
 * exactly that reason; this is the shared shape for the rest.
 *
 * Only the named keys are carried so read-only metadata (ids, timestamps, counts,
 * masked secrets) is never echoed back at the API. `rename` maps a key as the GET
 * spells it onto the name the POST binds, for endpoints whose two halves disagree.
 */
export function carryCurrent(
  current: unknown,
  keys: readonly string[],
  rename: Record<string, string> = {}
): Record<string, unknown> {
  const source = unwrapData(current);
  const carried: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    carried[rename[key] ?? key] = value;
  }
  return carried;
}

/** Peels one `{ data: {...} }` envelope when present; anything that is not an object reads as empty. */
export function unwrapData(response: unknown): Record<string, unknown> {
  if (!isRecord(response)) return {};
  return isRecord(response.data) ? response.data : response;
}

/**
 * Finds one record in a list response -- a bare array, or an envelope whose first
 * array-valued property holds the rows (`keys`, `configurations`, `data`, ...).
 * For the endpoints that have no GET-by-id and can only be read back as a list.
 */
export function findInList(
  response: unknown,
  predicate: (item: Record<string, unknown>) => boolean
): Record<string, unknown> | undefined {
  const items = Array.isArray(response)
    ? response
    : isRecord(response)
      ? Object.values(response).find(Array.isArray)
      : undefined;
  return (items ?? []).filter(isRecord).find(predicate);
}

/**
 * Case-insensitive equality -- ONLY for values the server has already matched exactly
 * (key save's GetsByKeyNames rows) or that the CLI itself keys (a key's per-culture
 * resources, where case-blind matching avoids near-duplicate culture entries). Never
 * use it to pick the record a name-keyed upsert will hit: the servers' Mongo Eq
 * lookups are case-sensitive, so a case-insensitive pick can carry one record's
 * fields into what the server then treats as a create.
 */
export function sameName(value: unknown, expected: unknown): boolean {
  return typeof value === "string" && typeof expected === "string" && value.toLowerCase() === expected.toLowerCase();
}
