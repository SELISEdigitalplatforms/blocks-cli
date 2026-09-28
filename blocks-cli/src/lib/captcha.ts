import { blocksRequest } from "./api.js";
import { CliActionableError } from "./errors.js";
import { requestContext } from "./request-context.js";
import { isNotFoundError } from "./secrets.js";

/**
 * blocks-os CaptchaConfigController ([Route("captcha")]). Configurations are records
 * under one key/value-store key; the store's ItemId is the id callers address them by.
 * The captcha secret is stored server-side: a read returns only a `secretId` reference,
 * never the value, and no CLI command reveals it -- re-saving with --captcha-secret is
 * the only way to change it.
 */
export const OS_CAPTCHA_API = "/os/v4/captcha";

/**
 * Providers blocks-iam can verify (Captcha.Driver's verification services). The
 * server itself only requires a non-empty provider, so this is a CLI guard against
 * saving a name IAM would then fail every login against. The portal offers recaptcha
 * and hcaptcha; bcaptcha is the built-in Blocks captcha.
 */
export const CAPTCHA_PROVIDERS = ["recaptcha", "hcaptcha", "bcaptcha"] as const;

type Flags = Record<string, string | boolean>;

export type CaptchaConfig = {
  id?: string;
  isEnable?: boolean;
  provider?: string;
  captchaKey?: string;
  captchaGenerator?: string;
  secretId?: string | null;
} & Record<string, unknown>;

export async function listCaptchaConfigs(projectKey: string, flags: Flags): Promise<CaptchaConfig[]> {
  const result = await blocksRequest<unknown>(`${OS_CAPTCHA_API}/list`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  return Array.isArray(result) ? (result as CaptchaConfig[]) : [];
}

export async function getCaptchaConfig(id: string, projectKey: string, flags: Flags): Promise<CaptchaConfig> {
  try {
    return await blocksRequest<CaptchaConfig>(`${OS_CAPTCHA_API}/get/${encodeURIComponent(id)}`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    throw new CliActionableError(
      `Captcha configuration '${id}' was not found.`,
      "captcha_not_found",
      "Run 'blocks captcha list --json' and use one of the listed ids."
    );
  }
}

/**
 * The configuration blocks-iam actually enforces at login: its repository reads all
 * records ordered by id (ordinal) and takes the FIRST enabled one. Several enabled
 * records are therefore not an error server-side, but only one of them is live -- this
 * is what the list output and 'captcha enable' surface as activeForLogin.
 */
export function activeCaptchaConfig(configs: CaptchaConfig[]): CaptchaConfig | undefined {
  return [...configs]
    .sort((a, b) => compareOrdinal(a.id ?? "", b.id ?? ""))
    .find((config) => config.isEnable === true);
}

function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The fields a caller may see. Built explicitly so a future server field can never leak through. */
export function captchaSummary(config: CaptchaConfig): Record<string, unknown> {
  return {
    captchaGenerator: config.captchaGenerator,
    captchaKey: config.captchaKey,
    id: config.id,
    isEnable: config.isEnable,
    provider: config.provider,
    secretId: config.secretId ?? undefined
  };
}
