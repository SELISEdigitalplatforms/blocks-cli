/**
 * blocks-os DomainController ([Route("[controller]/[action]")]).
 * Configure sets the tenant cookie/custom domain; there is no read-back or
 * disable HTTP action today (DisableDomainBindingAsync exists in the service
 * layer only).
 */
export const OS_DOMAIN_API = "/os/v4/Domain";

export type BaseOsResponse = {
  isSuccess?: boolean;
  message?: string | null;
  errors?: Record<string, string> | null;
} & Record<string, unknown>;

/** Prefer Message, then the first Errors value — matches DomainController envelopes. */
export function upstreamOsMessage(response: BaseOsResponse | undefined, fallback: string): string {
  if (!response) return fallback;
  if (typeof response.message === "string" && response.message.trim()) return response.message;
  const errors = response.errors;
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors)) {
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return fallback;
}
