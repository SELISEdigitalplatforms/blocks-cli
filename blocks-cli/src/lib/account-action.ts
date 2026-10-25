import { readConfig, resolveAccountProfile } from "./config.js";
import { requestContext } from "./request-context.js";

/** IAM's hosted activation page under OIDC (`accountActivationPath`). */
export const OIDC_ACTIVATION_PATH = "oidc/activate/";

/**
 * The account-action base URL to save when OIDC login is on: the account's own IAM host.
 *
 * Under OIDC, activation and recovery links land on IAM's hosted pages (`<iam>/oidc/activate/`),
 * and IAM pins the stored base URL to its own host (AuthenticationConfigurationService, since
 * 2026-09-09). Keeping a project's preset app domain instead produced links to an app that may
 * not be deployed yet -- the first user's activation link 404'd.
 */
export async function iamAccountActionBaseUrl(flags: Record<string, string | boolean>): Promise<string> {
  const { profile } = await resolveAccountProfile(await readConfig(), requestContext(flags).accountName);
  return profile.oidcUrl.replace(/\/+$/, "");
}

/**
 * A warning when `<base>/<path>` does not answer, so an activation email built from it would
 * be dead -- or undefined when it does. Never throws: an unreachable host is reported, not fatal.
 */
export async function unreachableActionPageWarning(baseUrl: string, path = OIDC_ACTIVATION_PATH): Promise<string | undefined> {
  // Offline runs and test suites opt out, as with BLOCKS_NO_UPDATE_CHECK.
  if (process.env.BLOCKS_NO_LINK_CHECK) return undefined;
  // The base comes from the account profile (its IAM host) or a flag, so parse it and probe
  // only an http(s) URL -- anything else is reported instead of fetched.
  let target: string;
  try {
    const url = new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error(url.protocol);
    target = url.href;
  } catch {
    return `${baseUrl} is not an http(s) URL, so activation links built on it will not open.`;
  }
  try {
    const response = await fetch(target, { method: "GET", redirect: "manual", signal: AbortSignal.timeout(5000) });
    if (response.status < 400) return undefined;
    return `${target} answers ${response.status}, so activation and password-reset links built on it will not open. Use an IAM host that serves it (--account-action-base-url) before creating users.`;
  } catch (error) {
    return `${target} did not answer (${error instanceof Error ? error.message : String(error)}); activation links built on it may not open.`;
  }
}
