import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyTranslateAll(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = compact({
    defaultLanguage: stringFlag(flags, "default-language") || undefined,
    messageCoRelationId: stringFlag(flags, "message-co-relation-id") || undefined,
    moduleId: stringFlag(flags, "module-id") || undefined
  });

  if (!body.moduleId) throw new Error("Provide --module-id.");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/TranslateAll", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Translate all untranslated keys in module '${body.moduleId}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/TranslateAll", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
