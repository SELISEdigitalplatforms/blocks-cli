export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Schema list responses are normally `{ isSuccess, data: { items, totalCount } }`.
 * Some deployments/proxies have been observed double-wrapping as
 * `{ data: { data: { items, totalCount } } }`; tolerate one extra level of
 * nesting rather than silently treating a malformed response as an empty list.
 */
export function unwrapSchemaListResponse(response: unknown): { items: Record<string, unknown>[]; totalCount: number } {
  const direct = isRecord(response) && isRecord(response.data) ? response.data : undefined;
  const nested = direct && isRecord(direct.data) ? direct.data : undefined;
  const candidate = nested ?? direct;

  if (candidate && Array.isArray(candidate.items)) {
    const items = candidate.items.filter(isRecord);
    const totalCount = typeof candidate.totalCount === "number" ? candidate.totalCount : items.length;
    return { items, totalCount };
  }

  throw new Error(`Unexpected schema list response shape: ${JSON.stringify(response)}`);
}

/** Unwraps a `{ isSuccess, data: [...] }` service envelope into its `data` array. */
export function unwrapDataArray(response: unknown, context: string): Record<string, unknown>[] {
  if (isRecord(response) && Array.isArray(response.data)) return response.data.filter(isRecord);
  throw new Error(`Unexpected ${context} response shape: ${JSON.stringify(response)}`);
}
