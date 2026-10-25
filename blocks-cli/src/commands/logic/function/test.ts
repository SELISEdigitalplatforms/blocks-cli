import { readFile } from "node:fs/promises";
import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { CliActionableError } from "../../../lib/errors.js";
import { requireId, testFunction } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Run the saved working copy once (Functions/Test), building its image first when
 * needed. Runs the code for real -- side effects included -- but never deploys.
 * `--input` is the request body for a POST trigger and the query for a GET one.
 */
export async function logicFunctionTest(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const usage = "blocks logic function test <function-id> [--input '<json>'|--input-file <path>] [--rebuild] [--wait-timeout <s>] [--json]";
  const functionId = requireId(args[0], "function id", "function_id_required", usage);

  const inline = stringFlag(flags, "input");
  const inputFile = stringFlag(flags, "input-file");
  if (inline && inputFile) {
    throw new CliActionableError("Pass --input or --input-file, not both.", "FUNCTION_VALIDATION", `Usage: ${usage}`);
  }
  const inputJson = inputFile ? await readFile(inputFile, "utf8") : inline || undefined;
  if (inputJson !== undefined) {
    try {
      JSON.parse(inputJson);
    } catch (error) {
      throw new CliActionableError(`Test input is not valid JSON: ${(error as Error).message}`, "FUNCTION_VALIDATION");
    }
  }

  const waitTimeout = optionalIntegerFlag(flags, "wait-timeout");
  const body: Record<string, unknown> = { functionId, rebuild: booleanFlag(flags, "rebuild") };
  if (inputJson !== undefined) body.inputJson = inputJson;
  if (waitTimeout !== undefined) body.waitTimeoutSeconds = waitTimeout;

  const projectKey = await selectedProject(flags);
  const result = await testFunction({ projectKey, flags, body });
  if (typeof result.buildId === "string" && result.buildId && !result.runId) {
    writeOutput({
      ...result,
      nextStep: `The image is still building. Watch it with \`blocks logic function build ${result.buildId}\`, then run the test again.`
    }, flags);
    return;
  }
  writeOutput(result, flags);
}
