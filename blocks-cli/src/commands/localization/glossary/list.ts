import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationGlossaryList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Glossary/Gets", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: {
      IsGlobal: optionalBooleanFlag(flags, "is-global"),
      ModuleId: stringFlag(flags, "module-id") || undefined,
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      SearchText: stringFlag(flags, "search") || undefined
    }
  });
  writeOutput(result, flags);
}
