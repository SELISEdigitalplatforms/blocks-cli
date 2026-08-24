import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { isRecord } from "./data-response.js";
import { pathsFromWorkspace, readWorkspaceConfig } from "./workspace.js";

export type SchemaDocument = Record<string, unknown> & {
  fields?: Array<Record<string, unknown>>;
  itemId?: string;
  schemaName?: string;
};

export type PortablePolicy = Record<string, unknown> & {
  policyName?: string;
  schemaName?: string;
};

const SYSTEM_FIELDS = new Set([
  "ItemId",
  "CreatedDate",
  "CreatedBy",
  "LastUpdatedDate",
  "LastUpdatedBy",
  "Language",
  "OrganizationId",
  "Tags"
]);

// Non-portable schema-level metadata: server id, project identifiers, generated
// GraphQL operation names, access-policy metadata, and reference/count summaries.
const SCHEMA_DENY_KEYS = new Set([
  "id",
  "projectKey",
  "projectShortKey",
  "projectSchemaName",
  "querySchema",
  "mutationSchemas",
  "readAccessLevel",
  "writeAccessLevel",
  "editAccessLevel",
  "deleteAccessLevel",
  "readPolicies",
  "writePolicies",
  "editPolicies",
  "deletePolicies",
  "schemaReferences",
  "totalSchemaReferences",
  "totalReadPolicies",
  "totalWritePolicies",
  "totalEditPolicies",
  "totalDeletePolicies"
]);

// Non-portable per-field metadata: access-policy levels and policy/validation counts.
const FIELD_DENY_KEYS = new Set([
  "readAccessLevel",
  "writeAccessLevel",
  "editAccessLevel",
  "deleteAccessLevel",
  "totalReadPolicies",
  "totalWritePolicies",
  "totalEditPolicies",
  "totalDeletePolicies",
  "totalValidationRules"
]);

function omit(record: Record<string, unknown>, deny: Set<string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (!deny.has(key)) result[key] = value;
  }
  return result;
}

function portableField(field: Record<string, unknown>): Record<string, unknown> {
  const stripped = omit(field, FIELD_DENY_KEYS);
  if (Array.isArray(stripped.fields)) {
    stripped.fields = stripped.fields.filter(isRecord).map(portableField);
  }
  return stripped;
}

/** Strips API ids, project identifiers, and access/count metadata so a pulled schema is portable and re-pushable. */
export function toPortableSchema(raw: Record<string, unknown>): SchemaDocument {
  const schema = omit(raw, SCHEMA_DENY_KEYS);
  if (Array.isArray(schema.fields)) {
    schema.fields = schema.fields
      .filter(isRecord)
      .filter((field) => !(typeof field.name === "string" && SYSTEM_FIELDS.has(field.name)))
      .map(portableField);
  }
  return schema as SchemaDocument;
}

/**
 * Maps a `DataAccessPolicyResponse` API item onto the CLI's portable rules format.
 * The read API exposes the target schema as `entityName`, while the create/update
 * request DTOs expect `schemaName` -- field names are mapped explicitly rather than
 * spreading the response, and the source project's `itemId`/`schemaId` are dropped
 * since they are meaningless in a different destination project.
 *
 * `entityName` has been observed coming back as an empty string against a live
 * project (the backend appears not to populate it), so `fallbackSchemaName` --
 * the name the policy was queried by -- is used whenever the response doesn't
 * supply a usable one.
 */
export function toPortablePolicy(raw: Record<string, unknown>, fallbackSchemaName?: string): PortablePolicy {
  const entityName = typeof raw.entityName === "string" && raw.entityName ? raw.entityName : undefined;
  const rawSchemaName = typeof raw.schemaName === "string" && raw.schemaName ? raw.schemaName : undefined;
  const policy: PortablePolicy = {
    schemaName: entityName ?? rawSchemaName ?? fallbackSchemaName ?? "",
    policyName: String(raw.policyName ?? "")
  };
  if (typeof raw.policyDescription === "string") policy.policyDescription = raw.policyDescription;
  if (raw.policyType !== undefined) policy.policyType = raw.policyType;
  if (raw.operation !== undefined) policy.operation = raw.operation;
  if (Array.isArray(raw.fieldNames)) policy.fieldNames = raw.fieldNames;
  if (raw.ruleGroup !== undefined) policy.ruleGroup = raw.ruleGroup;
  if (typeof raw.priority === "number") policy.priority = raw.priority;
  if (typeof raw.isAllowPolicy === "boolean") policy.isAllowPolicy = raw.isAllowPolicy;
  return policy;
}

export async function readSchemaFiles(): Promise<Array<{ file: string; schema: SchemaDocument }>> {
  const workspace = await readWorkspaceConfig();
  const { schemas } = pathsFromWorkspace(workspace);
  const files = await readdir(schemas).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const result: Array<{ file: string; schema: SchemaDocument }> = [];

  for (const file of files.filter((item) => item.endsWith(".json"))) {
    const fullPath = join(schemas, file);
    result.push({
      file: fullPath,
      schema: JSON.parse(await readFile(fullPath, "utf8")) as SchemaDocument
    });
  }

  return result;
}

export async function writeSchemaFile(schema: SchemaDocument): Promise<string> {
  const workspace = await readWorkspaceConfig();
  const { schemas } = pathsFromWorkspace(workspace);
  await mkdir(schemas, { recursive: true });
  const name = String(schema.schemaName ?? schema.name ?? schema.itemId ?? "schema");
  const path = join(schemas, `${name}.json`);
  await writeFile(path, `${JSON.stringify(schema, null, 2)}\n`);
  return path;
}

export async function readRulesFile(): Promise<Record<string, unknown>> {
  const workspace = await readWorkspaceConfig();
  const { rules } = pathsFromWorkspace(workspace);
  return JSON.parse(await readFile(rules, "utf8")) as Record<string, unknown>;
}

export async function writeRulesFile(data: unknown): Promise<string> {
  const workspace = await readWorkspaceConfig();
  const { rules } = pathsFromWorkspace(workspace);
  await mkdir(dirname(rules), { recursive: true });
  await writeFile(rules, `${JSON.stringify(data, null, 2)}\n`);
  return rules;
}

export function validateSchemas(schemas: Array<{ file: string; schema: SchemaDocument }>): string[] {
  const errors: string[] = [];

  for (const { file, schema } of schemas) {
    if (!schema.schemaName || typeof schema.schemaName !== "string") {
      errors.push(`${file}: missing string schemaName`);
    }

    if (!Array.isArray(schema.fields)) continue;

    for (const field of schema.fields) {
      const name = field.name;
      if (typeof name === "string" && SYSTEM_FIELDS.has(name)) {
        errors.push(`${file}: field '${name}' is platform-managed and must not be defined`);
      }
    }
  }

  return errors;
}
