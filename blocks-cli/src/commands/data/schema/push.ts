import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { readSchemaFiles, validateSchemas } from "../../../lib/data-files.js";
import { isRecord, unwrapSchemaListResponse } from "../../../lib/data-response.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

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
  const warnings: string[] = [];

  for (const { file, schema } of schemas) {
    const schemaName = String(schema.schemaName);
    const localId = schema.itemId ?? (schema as { id?: unknown }).id;

    // Look up the destination project's own copy of this schema by name -- a
    // local id/itemId may belong to a different project and must never be
    // trusted directly (see CLAUDE_HANDOFF.md #1).
    const existingResponse = await blocksRequest<unknown>("/data/v4/schemas", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { PageNo: 1, PageSize: 5, ProjectKey: projectKey, SchemaName: schemaName }
    });
    const { items } = unwrapSchemaListResponse(existingResponse);
    const destination = items.find((item) => item.schemaName === schemaName);
    const destinationId = typeof destination?.id === "string" ? destination.id : undefined;

    if (!destinationId && localId) {
      warnings.push(`${file}: ignoring local id for '${schemaName}' -- no matching schema found in project '${projectKey}'; creating instead.`);
    }

    const portable: Record<string, unknown> = { ...schema };
    delete portable.itemId;
    delete portable.id;
    const body = destinationId ? { ...portable, itemId: destinationId, projectKey } : { ...portable, projectKey };

    const response = await blocksRequest<unknown>("/data/v4/schemas/define", {
      acceptFailureEnvelope: true,
      body,
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      method: destinationId ? "PUT" : "POST"
    });

    if (response === undefined || response === null) {
      throw new Error(`Push failed for schema '${schemaName}': the server returned an empty response.`);
    }
    if (isRecord(response) && response.isSuccess === false) {
      throw new Error(`Push failed for schema '${schemaName}': ${JSON.stringify(response)}`);
    }

    results.push(response);
  }

  writeOutput({ results, ...(warnings.length ? { warnings } : {}) }, flags);
}
