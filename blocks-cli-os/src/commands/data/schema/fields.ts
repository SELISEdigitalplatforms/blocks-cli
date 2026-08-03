import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * `fields` (a FieldDefinitionRequest[]: name/type/isArray/isPIIData/isUniqueData/description) has no
 * single-value flag equivalent - pass it via --body/--file. Convenience flags cover the scalar/array-of-string fields.
 */
export async function dataSchemaFields(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      deletableFieldNames: listFlag(flags, "deletable-fields"),
      schemaDefinitionItemId: stringFlag(flags, "schema-id") || undefined
    })
  };

  if (!body.schemaDefinitionItemId) throw new Error("Provide --schema-id (the target schema's itemId).");
  if (!Array.isArray(body.fields) && !Array.isArray(body.deletableFieldNames)) {
    throw new Error("Provide --deletable-fields a,b and/or a 'fields' array via --body/--file.");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/schemas/fields", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save field definitions for schema '${body.schemaDefinitionItemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/schemas/fields", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
