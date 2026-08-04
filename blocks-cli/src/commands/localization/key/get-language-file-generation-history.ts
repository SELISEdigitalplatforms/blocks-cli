import { integerFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetLanguageFileGenerationHistory(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetLanguageFileGenerationHistory", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: {
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20)
    }
  });
  writeOutput(result, flags);
}
