import { booleanFlag, stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { confirmMutation } from "../../../../lib/confirm.js";
import { CliActionableError } from "../../../../lib/errors.js";
import { compact, jsonBodyFlag, listFlag } from "../../../../lib/json-flag.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";
import { withGatewayReload } from "../../../../lib/data-gateway.js";

const ENDPOINT = "/data/v4/schemas/indexes";

/** Mirrors CreateSchemaIndexRequestValidator: 1-10 distinct fields per index. */
const MAX_FIELDS = 10;

/**
 * `--fields name,createdDate:desc` -> [{ fieldName, direction }]. SortDirection is
 * serialized by name (JsonStringEnumConverter), so the wire form is "ASC"/"DESC".
 */
function parseIndexFields(items: string[]): Array<{ fieldName: string; direction: "ASC" | "DESC" }> {
  return items.map((item) => {
    const [fieldName, rawDirection = "asc"] = item.split(":").map((part) => part.trim());
    const direction = rawDirection.toUpperCase();
    if (!fieldName || (direction !== "ASC" && direction !== "DESC")) {
      throw new CliActionableError(
        `'${item}' is not a valid index field.`,
        "invalid_index_field",
        "Use --fields name[:asc|desc],... e.g. --fields status,createdDate:desc."
      );
    }
    return { fieldName, direction };
  });
}

export async function dataSchemaIndexesCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const fieldItems = listFlag(flags, "fields");
  const body: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      fields: fieldItems ? parseIndexFields(fieldItems) : undefined,
      isUnique: booleanFlag(flags, "unique") || undefined,
      name: stringFlag(flags, "name") || undefined,
      schemaDefinitionItemId: stringFlag(flags, "schema-id") || undefined
    })
  };

  if (!body.schemaDefinitionItemId) throw new Error("Provide --schema-id (the target schema's itemId).");
  const fields = Array.isArray(body.fields) ? body.fields : [];
  if (fields.length === 0 || fields.length > MAX_FIELDS) {
    throw new CliActionableError(
      `An index needs 1-${MAX_FIELDS} fields; got ${fields.length}.`,
      "invalid_index_fields",
      "Pass --fields name[:asc|desc],... (or a 'fields' array via --body/--file)."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: ENDPOINT, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create an index on schema '${body.schemaDefinitionItemId}'.`);
  const projectKey = await selectedProject(flags);
  let result: unknown;
  try {
    result = await blocksRequest<unknown>(ENDPOINT, {
      body,
      impersonatedProjectAuth: true,
      method: "POST",
      ...requestContext(flags),
      projectTenantId: projectKey
    });
  } catch (error) {
    // GeoJson fields are rejected here too, and the server's code alone doesn't say why.
    if (error instanceof Error && error.message.includes("FIELD_NOT_INDEXABLE")) {
      throw new CliActionableError(
        error.message,
        "field_not_indexable",
        "Only scalar fields of an Entity schema can be indexed. GeoJson fields are excluded: their 2dsphere "
          + "index is created automatically when the field is saved (see 'blocks data schema indexes list')."
      );
    }
    throw error;
  }
  writeOutput(await withGatewayReload(flags, projectKey, result), flags);
}
