import { booleanFlag, integerFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataSchemaAggregation(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/schemas/aggregation", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      CollectionName: stringFlag(flags, "collection-name") || undefined,
      Keyword: stringFlag(flags, "keyword") || undefined,
      PageNo: integerFlag(flags, "page", 1),
      PageSize: integerFlag(flags, "page-size", 100),
      ProjectKey: projectKey,
      SchemaName: stringFlag(flags, "schema-name") || undefined,
      SchemaType: optionalIntegerFlag(flags, "schema-type"),
      SortBy: stringFlag(flags, "sort-by") || undefined,
      SortDescending: booleanFlag(flags, "sort-desc") || undefined
    }
  });
  writeOutput(result, flags);
}
