import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailTemplateList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Mail/GetTemplates", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      IsDescending: optionalBooleanFlag(flags, "sort-desc"),
      Language: stringFlag(flags, "language") || undefined,
      MailConfigurationId: stringFlag(flags, "configuration-id") || undefined,
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      SearchKey: stringFlag(flags, "search") || undefined,
      SortProperty: stringFlag(flags, "sort-by") || undefined
    }
  });
  writeOutput(result, flags);
}
