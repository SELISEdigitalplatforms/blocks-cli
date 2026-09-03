import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { CAPTCHA_PROVIDERS, CaptchaConfig, OS_CAPTCHA_API, captchaSummary } from "../../lib/captcha.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { redactSecrets } from "../../lib/redact.js";
import { requestContext } from "../../lib/request-context.js";
import { requireOneOf } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Create or update a captcha configuration (captcha/save). Omit --id to create; pass it
 * to update. The server stores the captcha secret in the Secrets store: on create a
 * non-empty --captcha-secret creates that secret, on update it ROTATES the linked one,
 * and an omitted/empty --captcha-secret leaves the stored value untouched.
 */
export async function captchaSave(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const provider = stringFlag(flags, "provider");
  if (provider) requireOneOf(provider, CAPTCHA_PROVIDERS, "provider", "invalid_captcha_provider");

  const body: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      captchaGenerator: stringFlag(flags, "generator") || undefined,
      captchaKey: stringFlag(flags, "captcha-key") || undefined,
      captchaSecret: stringFlag(flags, "captcha-secret") || undefined,
      id: args[0] || stringFlag(flags, "id") || undefined,
      isEnable: optionalBooleanFlag(flags, "enable"),
      provider: provider ? provider.toLowerCase() : undefined
    })
  };

  const isUpdate = typeof body.id === "string" && body.id.length > 0;
  if (!body.provider) {
    throw new CliActionableError(
      "--provider is required (the server rejects an empty provider).",
      "captcha_provider_required",
      `Re-run with --provider ${CAPTCHA_PROVIDERS.join("|")}.`
    );
  }
  if (!isUpdate && body.isEnable === undefined) {
    // The server field is a plain bool: omitted means false, which would silently create
    // a configuration IAM never enforces. Make the caller say which they want.
    throw new CliActionableError(
      "Pass --enable or --enable=false when creating a captcha configuration.",
      "captcha_enable_required",
      "Add --enable to enforce it at login, or --enable=false to save it inactive."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        action: isUpdate ? "update" : "create",
        dryRun: true,
        endpoint: `${OS_CAPTCHA_API}/save`,
        request: redactSecrets(body, ["captchasecret"]),
        secretHandling: body.captchaSecret
          ? isUpdate ? "rotate the linked secret" : "create a new secret"
          : "leave the stored secret untouched"
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    isUpdate
      ? `Update captcha configuration '${body.id as string}' (provider ${body.provider as string})${body.captchaSecret ? " and rotate its secret" : ""}.`
      : `Create a ${body.isEnable ? "ENABLED" : "disabled"} captcha configuration for provider '${body.provider as string}'.`
  );

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<CaptchaConfig>(`${OS_CAPTCHA_API}/save`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(captchaSummary(result ?? {}), flags);
}
