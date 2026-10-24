/**
 * Storage configuration fields that hold a credential, beyond the shared list in
 * `lib/redact.ts` (which leaves `secretKey` out on purpose). Sent only on create;
 * blocks-os stores them in SecretStore and never returns them.
 */
export const STORAGE_SECRET_FIELDS: readonly string[] = ["secretkey", "sftpsecretkey"];
