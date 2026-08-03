import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationLanguageSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      isDefault: booleanFlag(flags, "is-default") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      languageCode: stringFlag(flags, "language-code") || undefined,
      languageName: stringFlag(flags, "language-name") || undefined
    })
  };

  if (!body.languageName) throw new Error("Provide --language-name (or set it in --body/--file).");
  if (!body.languageCode) throw new Error("Provide --language-code (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Language/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save language '${body.languageName}' (${body.languageCode}).`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Language/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
