import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Upsert: omit --item-id to create, pass it to update. `validations` (an array of
 * { type, value, secondaryValue?, errorMessage?, isActive }) has no scalar flag
 * equivalent - pass it via --body/--file, e.g. --body '{"validations":[{"type":1,"value":"^[0-9]+$","isActive":true}]}'.
 */
export async function dataValidationSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      fieldName: stringFlag(flags, "field-name") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      schemaId: stringFlag(flags, "schema-id") || undefined
    })
  };

  if (!body.schemaId) throw new Error("Provide --schema-id (or set it in --body/--file).");
  if (!body.fieldName) throw new Error("Provide --field-name (or set it in --body/--file).");
  if (!Array.isArray(body.validations) || !body.validations.length) {
    throw new Error("Provide validation rules via --body/--file, e.g. { \"validations\": [{ \"type\": 1, \"value\": \"...\", \"isActive\": true }] }.");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/data-validations", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save data validation for schema '${body.schemaId}' field '${body.fieldName}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/data-validations", {
    body,
    impersonatedProjectAuth: true,
    method: body.itemId ? "PUT" : "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
