import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { CAPTCHA_PROVIDERS, CaptchaConfig, OS_CAPTCHA_API, captchaSummary, getCaptchaConfig } from "../../lib/captcha.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { carryCurrent } from "../../lib/merge-current.js";
import { writeOutput } from "../../lib/output.js";
import { redactSecrets } from "../../lib/redact.js";
import { requestContext } from "../../lib/request-context.js";
import { requireOneOf } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function captchaSave(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const provider = stringFlag(flags, "provider");
  if (provider) requireOneOf(provider, CAPTCHA_PROVIDERS, "provider", "invalid_captcha_provider");

  const overrides: Record<string, unknown> = {
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

  const isUpdate = typeof overrides.id === "string" && overrides.id.length > 0;

  // The save endpoint rebuilds the stored record from the request -- IsEnable, Provider,
  // CaptchaKey and CaptchaGenerator -- and only the linked secret is preserved when
  // captchaSecret is left empty. An update that merely rotated the secret therefore
  // switched the configuration off and blanked its site key. Read the record first and
  // merge, the same way `captcha enable`/`disable` already re-save it; a new
  // configuration has nothing to carry, so its dry-run stays offline.
  const current = isUpdate
    ? carryCurrent(
        await getCaptchaConfig(overrides.id as string, await selectedProject(flags), flags),
        ["isEnable", "provider", "captchaKey", "captchaGenerator"]
      )
    : {};
  const body: Record<string, unknown> = { ...current, ...overrides };

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
