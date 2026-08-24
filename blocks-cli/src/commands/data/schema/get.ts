import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { isRecord } from "../../../lib/data-response.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataSchemaGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/schemas/get-by-id", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { id }
  });
  writeOutput(result, flags);

  // --json stays machine-readable and unchanged; human runs also get the
  // exact GraphQL operation names, since they are naive string concatenation
  // (no English pluralization) rather than the pattern users tend to guess.
  if (!flags.json) {
    for (const line of graphqlOperationLines(result)) console.log(line);
  }
}

function graphqlOperationLines(result: unknown): string[] {
  const data = isRecord(result) && isRecord(result.data) ? result.data : undefined;
  if (!data) return [];

  const schemaName = typeof data.schemaName === "string" ? data.schemaName : undefined;
  const querySchema = typeof data.querySchema === "string" ? data.querySchema : undefined;
  const mutationSchemas = Array.isArray(data.mutationSchemas)
    ? data.mutationSchemas.filter((item): item is string => typeof item === "string")
    : [];
  if (!schemaName && !querySchema && mutationSchemas.length === 0) return [];

  const lines = ["", "GraphQL operation names (exact -- resolver names are not English-pluralized):"];
  if (querySchema) lines.push(`  Query:        get${querySchema}`);
  for (const mutation of mutationSchemas) lines.push(`  Mutation:     ${mutation}`);
  if (schemaName) {
    lines.push(`  Bulk insert:  insertMany${schemaName}`);
    lines.push(`  Bulk update:  updateMany${schemaName}`);
    lines.push(`  Bulk delete:  deleteMany${schemaName}`);
  }
  return lines;
}
