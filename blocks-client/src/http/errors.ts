export class BlocksApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly statusText: string,
    public readonly body: unknown
  ) {
    super(buildMessage(status, statusText, body));
    this.name = "BlocksApiError";
  }
}

function buildMessage(status: number, statusText: string, body: unknown): string {
  if (typeof body === "object" && body) {
    const record = body as Record<string, unknown>;
    const message = record.message ?? record.detail ?? record.error_description ?? record.error;
    if (typeof message === "string" && message) return `Blocks API ${status} ${statusText}: ${message}`;

    // Validation bodies (ASP.NET problem details and Blocks `errors` maps) carry the reason only in
    // `errors` / `title`; without this the message would be the bare status line.
    const details = describeErrors(record.errors ?? record.Errors);
    const title = typeof record.title === "string" ? record.title : "";
    if (details) return `Blocks API ${status} ${statusText}: ${details}`;
    if (title) return `Blocks API ${status} ${statusText}: ${title}`;
  }

  if (typeof body === "string" && body) return `Blocks API ${status} ${statusText}: ${body}`;
  return `Blocks API ${status} ${statusText}`;
}

const MAX_ERROR_ENTRIES = 5;

/** `{ Field: ["a", "b"] }` or `{ Field: "a" }` → `"Field: a, b; Other: c"` (first entries only). */
function describeErrors(errors: unknown): string {
  if (typeof errors !== "object" || !errors || Array.isArray(errors)) return "";
  const parts: string[] = [];
  for (const [field, value] of Object.entries(errors as Record<string, unknown>)) {
    const texts = (Array.isArray(value) ? value : [value]).filter(
      (text): text is string => typeof text === "string" && text.length > 0
    );
    if (texts.length === 0) continue;
    parts.push(field ? `${field}: ${texts.join(", ")}` : texts.join(", "));
    if (parts.length === MAX_ERROR_ENTRIES) break;
  }
  return parts.join("; ");
}
