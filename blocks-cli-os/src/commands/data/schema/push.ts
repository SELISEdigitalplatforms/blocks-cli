import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { readSchemaFiles, validateSchemas } from "../../../lib/data-files.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type SchemaListResponse = { data?: { items?: Array<Record<string, unknown> & { itemId?: string }> } };

export async function dataSchemaPush(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const schemas = await readSchemaFiles();
  const errors = validateSchemas(schemas);
  if (errors.length) throw new Error(`Schema validation failed:\n${errors.join("\n")}`);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, schemas: schemas.map((item) => item.schema.schemaName) }, flags);
    return;
  }

  await confirmMutation(flags, `Push ${schemas.length} data schema file(s) to project '${projectKey}'.`);
  const results: unknown[] = [];

  for (const { schema } of schemas) {
    const existing = await blocksRequest<SchemaListResponse>("/data/v4/schemas", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { PageNo: 1, PageSize: 5, ProjectKey: projectKey, SchemaName: String(schema.schemaName) }
    });
    const itemId = schema.itemId ?? existing.data?.items?.[0]?.itemId;
    const body = { ...schema, itemId, projectKey };
    results.push(await blocksRequest<unknown>("/data/v4/schemas/define", {
      body,
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      method: itemId ? "PUT" : "POST"
    }));
  }

  writeOutput({ results }, flags);
}
