import { readRulesFile, readSchemaFiles, validateSchemas, validateSecurityEntries } from "../../lib/data-files.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";

export async function dataValidate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const schemas = await readSchemaFiles();
  const errors = validateSchemas(schemas);

  try {
    errors.push(...validateSecurityEntries(await readRulesFile()));
  } catch (error) {
    errors.push(`rules file: ${(error as Error).message}`);
  }

  const result = { ok: errors.length === 0, errors, schemaCount: schemas.length };
  writeOutput(result, flags);
  if (!result.ok) process.exitCode = 1;
}
