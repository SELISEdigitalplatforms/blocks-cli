import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationLanguageDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const languageName = args[0] || stringFlag(flags, "language-name", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Language/Delete", query: { LanguageName: languageName } }, flags);
    return;
  }

  await confirmMutation(flags, `Delete language '${languageName}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Language/Delete", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId,
    query: { LanguageName: languageName }
  });
  writeOutput(result, flags);
}
