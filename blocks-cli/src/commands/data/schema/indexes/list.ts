import { stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { isRecord } from "../../../../lib/data-response.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";

export async function dataSchemaIndexesList(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const schemaDefinitionItemId = args[0] || stringFlag(flags, "schema-id", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/schemas/indexes", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { schemaDefinitionItemId }
  });
  writeOutput(result, flags);

  // `systemIndexes` (the automatic 2dsphere index of each GeoJson field) look like
  // ordinary indexes in the JSON, so human runs say why they can't be deleted.
  if (!flags.json && systemIndexCount(result) > 0) {
    console.log("");
    console.log("systemIndexes are the automatic 2dsphere indexes of GeoJson fields: read-only, not deletable,");
    console.log("and not counted against the 15-index limit. They follow the field - change its type or delete it.");
  }
}

function systemIndexCount(result: unknown): number {
  const data = isRecord(result) && isRecord(result.data) ? result.data : undefined;
  return data && Array.isArray(data.systemIndexes) ? data.systemIndexes.length : 0;
}
