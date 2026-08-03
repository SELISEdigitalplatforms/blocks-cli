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
  }

  if (typeof body === "string" && body) return `Blocks API ${status} ${statusText}: ${body}`;
  return `Blocks API ${status} ${statusText}`;
}
