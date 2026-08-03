export function decodeJwtPayload(token: string): Record<string, unknown> {
  const [, payload] = token.split(".");
  if (!payload) throw new Error("Invalid JWT: missing payload");

  const normalized = payload.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

export function tenantFromToken(token: string): string {
  const payload = decodeJwtPayload(token);
  const tenantId = payload.tenant_id;
  if (typeof tenantId !== "string" || !tenantId) {
    throw new Error("Login token did not contain tenant_id");
  }

  return tenantId;
}
