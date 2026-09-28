import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import {
  CaptchaConfig,
  OS_CAPTCHA_API,
  activeCaptchaConfig,
  captchaSummary,
  getCaptchaConfig,
  listCaptchaConfigs
} from "../../lib/captcha.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function captchaEnable(argv: string[]): Promise<void> {
  await setCaptchaEnabled(argv, true);
}

export async function captchaDisable(argv: string[]): Promise<void> {
  await setCaptchaEnabled(argv, false);
}

/**
 * Flips one configuration's isEnable without touching anything else: reads it, re-saves
 * it with the flag changed and NO captchaSecret (the server leaves the stored secret
 * untouched when that field is empty), then reports which configuration blocks-iam will
 * enforce afterwards -- IAM takes the first enabled record in id order, so enabling a
 * second one may not make it live, and the output says so instead of leaving it implicit.
 */
async function setCaptchaEnabled(argv: string[], isEnable: boolean): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const dryRun = booleanFlag(flags, "dry-run");
  const verb = isEnable ? "enable" : "disable";

  const projectKey = await selectedProject(flags);
  const current = await getCaptchaConfig(id, projectKey, flags);
  const body = {
    captchaGenerator: current.captchaGenerator ?? "",
    captchaKey: current.captchaKey ?? "",
    id,
    isEnable,
    provider: current.provider ?? ""
  };

  if (current.isEnable === isEnable) {
    const configs = await listCaptchaConfigs(projectKey, flags);
    writeOutput(
      {
        action: verb,
        activeForLogin: activeCaptchaConfig(configs)?.id ?? null,
        changed: false,
        config: captchaSummary(current),
        upToDate: true
      },
      flags
    );
    return;
  }

  if (dryRun) {
    const configs = await listCaptchaConfigs(projectKey, flags);
    const projected = configs.map((config) => (config.id === id ? { ...config, isEnable } : config));
    writeOutput(
      {
        action: verb,
        activeForLoginAfter: activeCaptchaConfig(projected)?.id ?? null,
        dryRun: true,
        endpoint: `${OS_CAPTCHA_API}/save`,
        request: body
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    isEnable
      ? `Enable captcha configuration '${id}' (provider ${body.provider}) so login requires a captcha.`
      : `Disable captcha configuration '${id}' (provider ${body.provider}).`
  );

  const saved = await blocksRequest<CaptchaConfig>(`${OS_CAPTCHA_API}/save`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  const configs = await listCaptchaConfigs(projectKey, flags);
  const active = activeCaptchaConfig(configs);
  const note =
    isEnable && active && active.id !== id
      ? `Configuration '${active.id}' is also enabled and sorts first, so blocks-iam keeps enforcing that one. Disable it to make '${id}' live.`
      : undefined;
  if (note) console.error(`Note: ${note}`);

  writeOutput(
    {
      action: verb,
      activeForLogin: active?.id ?? null,
      changed: true,
      config: captchaSummary(saved ?? { ...current, ...body }),
      note
    },
    flags
  );
}
