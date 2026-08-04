import { booleanFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { readRulesFile, readSchemaFiles, validateSchemas } from "../../lib/data-files.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";
import { dataReload } from "./reload.js";
import { dataRulesDeploy } from "./rules/deploy.js";
import { dataSchemaPush } from "./schema/push.js";

/**
 * Composed "deploy my data model" flow: validate local schemas/rules, push schemas, deploy
 * rules, then reload the data gateway so the changes actually take effect. Nothing else in
 * this CLI calls data:reload automatically -- pushed schema/rule changes can otherwise sit
 * staged without going live.
 */
export async function dataSync(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const dryRun = booleanFlag(flags, "dry-run");
  const projectKey = await selectedProject(flags);

  const schemas = await readSchemaFiles();
  const errors = validateSchemas(schemas);

  try {
    await readRulesFile();
  } catch (error) {
    if (!(dryRun && (error as NodeJS.ErrnoException).code === "ENOENT")) {
      errors.push(`rules file: ${(error as Error).message}`);
    }
  }

  if (errors.length) throw new Error(`Data model validation failed:\n${errors.join("\n")}`);

  if (dryRun) {
    writeOutput(
      { dryRun: true, project: projectKey, schemas: schemas.length, steps: ["data:schema:push", "data:rules:deploy", "data:reload"] },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    `Sync data model for project '${projectKey}': push ${schemas.length} schema(s), deploy rules, then reload the gateway.`
  );

  // Each step below prints its own output/confirmation-skip via --yes; this is 3 separate
  // JSON blocks (one per step), not one combined document, since each step is a full
  // existing command reused as-is rather than re-implemented to return a value.
  const subArgv = [...argv.filter((token) => token !== "--dry-run"), "--yes"];

  console.log("== data:schema:push ==");
  await dataSchemaPush(subArgv);

  console.log("== data:rules:deploy ==");
  await dataRulesDeploy(subArgv);

  console.log("== data:reload ==");
  await dataReload(subArgv);
}
