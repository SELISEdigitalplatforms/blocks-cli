import { activeCaptchaConfig, captchaSummary, listCaptchaConfigs } from "../../lib/captcha.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Every captcha configuration of the project, plus which one blocks-iam enforces at
 * login (activeForLogin: the first enabled record in id order, or null).
 */
export async function captchaList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const configs = await listCaptchaConfigs(projectKey, flags);
  const active = activeCaptchaConfig(configs);
  writeOutput(
    {
      activeForLogin: active?.id ?? null,
      configs: configs.map((config) => captchaSummary(config)),
      totalCount: configs.length
    },
    flags
  );
}
