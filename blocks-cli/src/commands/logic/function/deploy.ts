import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { deployFunction, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Deploy the saved working copy as a new version. When the image is still building
 * the server answers with a build id; by default the CLI watches that build and
 * deploys exactly it once it succeeds (--no-wait returns the build id instead).
 */
export async function logicFunctionDeploy(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required",
    "blocks logic function deploy <function-id> [--note <text>] [--rebuild] [--build-id <id>] [--no-wait] [--timeout <s>] [--dry-run] [--yes] [--json]");
  const note = stringFlag(flags, "note") || undefined;
  const rebuild = booleanFlag(flags, "rebuild");
  const buildId = stringFlag(flags, "build-id") || undefined;
  const wait = !booleanFlag(flags, "no-wait");
  const timeoutSeconds = integerFlag(flags, "timeout", 600);
  if (timeoutSeconds < 1) throw new Error("--timeout must be at least 1 second");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({
      dryRun: true,
      endpoint: "/logic/v4/Functions/Deploy",
      method: "POST",
      request: { functionId, note, rebuild, buildId },
      waitForBuild: wait
    }, flags);
    return;
  }

  await confirmMutation(flags, `Deploy the saved code of function '${functionId}' as a new live version.`);
  const projectKey = await selectedProject(flags);
  writeOutput(await deployFunction({ projectKey, flags, functionId, note, rebuild, buildId, wait, timeoutSeconds }), flags);
}
