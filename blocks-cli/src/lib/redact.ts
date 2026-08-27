/**
 * Field names that carry a credential in a Blocks request body.
 *
 * Every `--dry-run` that prints a request body must pass it through
 * `redactSecrets` before `writeOutput`. A dry-run is the step a human or agent
 * reads before approving the real mutation, so it is exactly the output most
 * likely to end up in a terminal scrollback, a chat transcript, or a CI log.
 * `scripts/lint-cli-contracts.mjs` fails the build when a command builds a
 * secret-bearing body and prints it unredacted, so this is enforced rather
 * than remembered.
 *
 * Deliberately excludes `secretKey`, which is not always the credential: in
 * `storage config save` it is the credential itself, so that command passes
 * the name explicitly via `extraNames` rather than relying on this list.
 */
export const SECRET_FIELD_NAMES: readonly string[] = [
  "accesskey",
  "accesskeyid",
  "accountpassword",
  "apikey",
  "clientsecret",
  "connectionstring",
  "password",
  "privatekey",
  "refreshtoken",
  "sastoken",
  "secret",
  "secretaccesskey"
];

/**
 * Recursively replaces every credential-bearing field with `***`, matching
 * field names case-insensitively at any depth. Non-secret fields keep their
 * original value and type, so a dry-run still shows the shape and the
 * non-sensitive values that were actually going to be sent.
 */
export function redactSecrets<T>(value: T, extraNames: readonly string[] = []): T {
  return redactFields(value, [...SECRET_FIELD_NAMES, ...extraNames]);
}

export function redactFields<T>(value: T, names: readonly string[]): T {
  const secretNames = new Set(names.map((name) => name.toLowerCase()));
  return redact(value, secretNames) as T;
}

/**
 * Strips the query string from a URL for display. A pre-signed storage upload
 * URL carries its own time-limited write credential in the query (an Azure SAS
 * token, an S3 `X-Amz-Signature`), so printing one verbatim leaks a usable
 * credential even though no Blocks token is involved. Keeps origin and path so
 * the output still identifies where the upload is going.
 */
export function redactUrlSecrets(value: string): string {
  try {
    const url = new URL(value);
    if (!url.search && !url.hash) return url.toString();
    return `${url.origin}${url.pathname}?***`;
  } catch {
    // Not a parseable URL -- it was never a usable credential, but it also
    // cannot be safely trimmed, so say nothing about its contents.
    return "***";
  }
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
