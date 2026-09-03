import { stringFlag } from "../../lib/args.js";
import { captchaSummary, getCaptchaConfig } from "../../lib/captcha.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** One captcha configuration by id. Returns secretId, never the secret value. */
export async function captchaGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const projectKey = await selectedProject(flags);
  const config = await getCaptchaConfig(id, projectKey, flags);
  writeOutput(captchaSummary(config), flags);
}
