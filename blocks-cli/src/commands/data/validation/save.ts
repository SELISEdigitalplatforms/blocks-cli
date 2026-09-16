import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { unwrapData } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { optionalSelectedProject, parseCommand, selectedProject } from "../../../lib/workspace.js";
import { withGatewayReload } from "../../../lib/data-gateway.js";

const ENDPOINT = "/data/v4/data-validations";
const BY_FIELD_ENDPOINT = "/data/v4/data-validations/by-schema-and-field";

/**
 * ValidationType in the server's declaration order (DataGateway `ServiceEnums.cs`).
 * The enum declares no explicit values and carries no `JsonStringEnumConverter`, so
 * the API binds it from these integers -- but nothing in the API publishes them, an
 * agent cannot guess them, and a wrong number stores a different rule than the one
 * asked for without any error. Names are accepted here and translated; the integers
 * still work for anything already scripted against them.
 */
const VALIDATION_TYPES = [
  "notempty",
  "regex",
  "minlength",
  "maxlength",
  "lengthrange",
  "equal",
  "notequal",
  "greaterthan",
  "lessthan",
  "greaterthanorequal",
  "lessthanorequal",
  "range"
] as const;

const NOT_EMPTY = 0;
const LENGTH_RANGE = 4;
const RANGE = 11;

/**
 * Types whose value the server reads through `Convert.ToInt32`/numeric comparison
 * (`DataValidationHelper`). Equal/NotEqual are deliberately absent: those compare
 * against the field's own declared type, so a value like "5" on a string field must
 * stay a string. A value that does not parse as a number is passed through untouched
 * either way, which keeps date bounds on the comparison types intact.
 */
const NUMERIC_VALUE_TYPES = new Set([2, 3, 4, 7, 8, 9, 10, 11]);

type ExistingValidation = { itemId: string; ruleCount: number };

function parseValidationType(raw: string): number {
  const normalized = raw.trim().toLowerCase().replace(/[\s_-]/g, "");
  const byName = VALIDATION_TYPES.indexOf(normalized as (typeof VALIDATION_TYPES)[number]);
  if (byName >= 0) return byName;

  if (/^\d+$/.test(normalized)) {
    const numeric = Number(normalized);
    if (numeric < VALIDATION_TYPES.length) return numeric;
  }

  throw new CliActionableError(
    `'${raw}' is not a validation type.`,
    "invalid_validation_type",
    `--type accepts ${VALIDATION_TYPES.join(", ")} (or 0-${VALIDATION_TYPES.length - 1}).`
  );
}

function coerceValue(raw: string, type: number): string | number {
  if (!NUMERIC_VALUE_TYPES.has(type)) return raw;
  const numeric = Number(raw);
  return raw.trim() !== "" && Number.isFinite(numeric) ? numeric : raw;
}

/**
 * Builds the single validation rule the scalar flags describe, so the common case --
 * one rule on one field -- never needs hand-written JSON. `validations` is the only
 * field of this payload with no scalar equivalent, which made `--body` mandatory here
 * and nowhere else, and inline JSON is exactly what Windows PowerShell mangles.
 */
function ruleFromFlags(flags: Record<string, string | boolean>): Record<string, unknown> | undefined {
  const rawType = stringFlag(flags, "type");
  if (!rawType) return undefined;

  const type = parseValidationType(rawType);
  const value = stringFlag(flags, "value");
  const secondaryValue = stringFlag(flags, "secondary-value");

  if (type !== NOT_EMPTY && !value) {
    throw new CliActionableError(
      `--type ${VALIDATION_TYPES[type]} needs a --value to compare against.`,
      "missing_validation_value",
      "Pass --value <pattern|number|bound>; only --type notempty takes no value."
    );
  }

  if ((type === LENGTH_RANGE || type === RANGE) && !secondaryValue) {
    throw new CliActionableError(
      `--type ${VALIDATION_TYPES[type]} is a range and needs both bounds.`,
      "missing_validation_secondary_value",
      "Pass the lower bound as --value and the upper bound as --secondary-value."
    );
  }

  return compact({
    errorMessage: stringFlag(flags, "error-message") || undefined,
    isActive: optionalBooleanFlag(flags, "is-active") ?? true,
    secondaryValue: secondaryValue ? coerceValue(secondaryValue, type) : undefined,
    type,
    value: value ? coerceValue(value, type) : undefined
  });
}

/**
 * Finds the validation record already attached to this schema field, if any.
 *
 * The create endpoint refuses a second record for the same schema+field, and answers
 * with HTTP 200 carrying `isSuccess: false` ("Validation already exists for this
 * schema field"). Without this lookup the only way past that was for the caller to
 * run `by-schema-field` themselves and retry with `--item-id`, so the documented
 * "upsert" was really create-or-fail. The read answers the same way when nothing is
 * there, hence `acceptFailureEnvelope`.
 */
async function findExistingValidation(
  schemaId: string,
  fieldName: string,
  projectTenantId: string,
  flags: Record<string, string | boolean>
): Promise<ExistingValidation | undefined> {
  const response = await blocksRequest<unknown>(BY_FIELD_ENDPOINT, {
    acceptFailureEnvelope: true,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: { fieldName, schemaId }
  });

  const record = unwrapData(response);
  const itemId = record.itemId;
  if (typeof itemId !== "string" || !itemId) return undefined;
  return { itemId, ruleCount: Array.isArray(record.validations) ? record.validations.length : 0 };
}

/**
 * Create or replace the validation rules on one schema field.
 *
 * One rule: `--type regex --value '^[0-9]+$' --error-message 'Digits only'`.
 * Several: a `validations` array via `--body`/`--file`.
 *
 * `--item-id` is optional and rarely needed -- without it the command looks the field
 * up and updates the record already there. The endpoint replaces the whole rule list,
 * so the rules passed are the rules the field ends up with; the dry-run reports how
 * many it would replace.
 */
export async function dataValidationSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const dryRun = booleanFlag(flags, "dry-run");
  const payload = await jsonBodyFlag(flags);
  const scalarRule = ruleFromFlags(flags);

  const body: Record<string, unknown> = {
    ...payload,
    ...compact({
      fieldName: stringFlag(flags, "field-name") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      schemaId: stringFlag(flags, "schema-id") || undefined
    })
  };

  if (scalarRule) {
    if (Array.isArray(payload.validations) && payload.validations.length > 0) {
      throw new CliActionableError(
        "--type describes one validation rule, but --body/--file already carries a 'validations' array.",
        "validation_rules_conflict",
        "Drop --type to keep the array, or drop 'validations' from the payload to build the rule from flags."
      );
    }
    body.validations = [scalarRule];
  }

  if (!body.schemaId) {
    throw new CliActionableError(
      "Provide --schema-id (or set it in --body/--file).",
      "missing_schema_id",
      "blocks data schema list --json lists the schemas in this project with their ids."
    );
  }

  if (!body.fieldName) {
    throw new CliActionableError(
      "Provide --field-name (or set it in --body/--file).",
      "missing_field_name",
      "blocks data schema get <schemaId> --json lists the schema's fields."
    );
  }

  if (!Array.isArray(body.validations) || body.validations.length === 0) {
    throw new CliActionableError(
      "No validation rules were given.",
      "missing_validation_rules",
      "Pass one rule as --type <name> --value <value>, or several as a \"validations\" array via --body/--file."
    );
  }

  const schemaId = String(body.schemaId);
  const fieldName = String(body.fieldName);
  const explicitItemId = typeof body.itemId === "string" && body.itemId ? body.itemId : undefined;

  if (dryRun) {
    const target = await describeDryRunTarget(schemaId, fieldName, explicitItemId, flags);
    writeOutput(
      compact({
        dryRun: true,
        endpoint: ENDPOINT,
        method: target.itemId ? "PUT" : "POST",
        note: target.note,
        replacesExistingRules: target.ruleCount,
        request: target.itemId ? { ...body, itemId: target.itemId } : body,
        target: target.mode
      }),
      flags
    );
    return;
  }

  const projectKey = await selectedProject(flags);
  const existing = explicitItemId
    ? undefined
    : await findExistingValidation(schemaId, fieldName, projectKey, flags);
  const itemId = explicitItemId ?? existing?.itemId;

  await confirmMutation(
    flags,
    itemId
      ? `Replace the validation rules on schema '${schemaId}' field '${fieldName}' (validation ${itemId}).`
      : `Create validation rules on schema '${schemaId}' field '${fieldName}'.`
  );

  const result = await blocksRequest<unknown>(ENDPOINT, {
    body: itemId ? { ...body, itemId } : body,
    impersonatedProjectAuth: true,
    method: itemId ? "PUT" : "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(await withGatewayReload(flags, projectKey, result), flags);
}

/**
 * Resolves create-vs-update for the preview. Reading current server state in a
 * dry-run is what the other merge-aware saves here already do, so the preview says
 * what will actually be stored. It stays tolerant, though: a dry-run that cannot
 * reach the project still prints the request rather than failing, and says which
 * half it could not resolve.
 */
async function describeDryRunTarget(
  schemaId: string,
  fieldName: string,
  explicitItemId: string | undefined,
  flags: Record<string, string | boolean>
): Promise<{ itemId?: string; mode: string; note?: string; ruleCount?: number }> {
  if (explicitItemId) return { itemId: explicitItemId, mode: "update" };

  try {
    const projectKey = await optionalSelectedProject(flags);
    if (!projectKey) {
      return {
        mode: "create-or-update",
        note: "No project resolved, so this preview did not check whether the field already has rules; the apply step resolves it."
      };
    }

    const existing = await findExistingValidation(schemaId, fieldName, projectKey, flags);
    return existing
      ? { itemId: existing.itemId, mode: "update", ruleCount: existing.ruleCount }
      : { mode: "create" };
  } catch (error) {
    return {
      mode: "create-or-update",
      note: `Could not check whether this field already has rules (${(error as Error).message}); the apply step resolves it.`
    };
  }
}
