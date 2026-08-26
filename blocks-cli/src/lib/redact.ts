export function redactFields<T>(value: T, names: readonly string[]): T {
  const secretNames = new Set(names.map((name) => name.toLowerCase()));
  return redact(value, secretNames) as T;
}

function redact(value: unknown, secretNames: ReadonlySet<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => redact(item, secretNames));
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      secretNames.has(key.toLowerCase()) ? "***" : redact(item, secretNames)
    ])
  );
}
