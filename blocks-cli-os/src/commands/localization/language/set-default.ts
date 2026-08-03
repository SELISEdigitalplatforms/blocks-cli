import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationLanguageSetDefault(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const languageName = args[0] || stringFlag(flags, "language-name", { required: true });
  const body = { languageName };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Language/SetDefault", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Set '${languageName}' as the default language.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Language/SetDefault", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
