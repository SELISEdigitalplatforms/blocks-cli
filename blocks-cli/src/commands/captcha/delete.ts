import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { OS_CAPTCHA_API, getCaptchaConfig } from "../../lib/captcha.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Deletes a captcha configuration. The server retires the stored captcha secret first,
 * then removes the configuration record. Deleting an unknown id is a server-side no-op,
 * so the CLI resolves the record up front to give a real not-found and a confirmation
 * that says what is being removed.
 */
export async function captchaDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const dryRun = booleanFlag(flags, "dry-run");

  const projectKey = await selectedProject(flags);
  const config = await getCaptchaConfig(id, projectKey, flags);

  if (dryRun) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${OS_CAPTCHA_API}/delete/${id}`,
        target: { id, isEnable: config.isEnable, provider: config.provider }
      },
      flags
    );
    return;
  }

  const activeNote = config.isEnable ? " It is currently ENABLED, so login stops requiring a captcha." : "";
  await confirmMutation(
    flags,
    `Delete captcha configuration '${id}' (provider ${config.provider ?? "?"}) and retire its stored secret.${activeNote} This cannot be undone.`
  );

  const result = await blocksRequest<unknown>(`${OS_CAPTCHA_API}/delete/${encodeURIComponent(id)}`, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput({ deleted: true, id, result }, flags);
}
