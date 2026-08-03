import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationAssistantTranslationSuggestion(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      currentLanguage: stringFlag(flags, "current-language") || undefined,
      destinationLanguage: stringFlag(flags, "destination-language") || undefined,
      destinationLanguageCode: stringFlag(flags, "destination-language-code") || undefined,
      elementApplicationContext: stringFlag(flags, "element-application-context") || undefined,
      elementDetailContext: stringFlag(flags, "element-detail-context") || undefined,
      elementType: stringFlag(flags, "element-type") || undefined,
      glossaryIds: listFlag(flags, "glossary-ids"),
      maxCharacterLength: stringFlag(flags, "max-character-length") ? Number(stringFlag(flags, "max-character-length")) : undefined,
      moduleId: stringFlag(flags, "module-id") || undefined,
      sourceText: stringFlag(flags, "source-text") || undefined,
      temperature: stringFlag(flags, "temperature") ? Number(stringFlag(flags, "temperature")) : undefined
    })
  };

  if (!body.sourceText) throw new Error("Provide --source-text (or set it in --body/--file).");

  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Assistant/GetTranslationSuggestion", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
