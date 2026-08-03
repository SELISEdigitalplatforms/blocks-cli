import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataValidationList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/data-validations", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      FieldName: stringFlag(flags, "field-name") || undefined,
      Keyword: stringFlag(flags, "keyword") || undefined,
      PageNo: integerFlag(flags, "page", 1),
      PageSize: integerFlag(flags, "page-size", 100),
      ProjectKey: projectKey,
      SchemaId: stringFlag(flags, "schema-id") || undefined,
      SortBy: stringFlag(flags, "sort-by") || undefined,
      SortDescending: booleanFlag(flags, "sort-desc") || undefined
    }
  });
  writeOutput(result, flags);
}
