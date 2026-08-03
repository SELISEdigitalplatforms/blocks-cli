import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathsFromWorkspace, readWorkspaceConfig } from "./workspace.js";

export type SchemaDocument = Record<string, unknown> & {
  fields?: Array<Record<string, unknown>>;
  itemId?: string;
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
