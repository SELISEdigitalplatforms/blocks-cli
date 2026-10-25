import { getFunction, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** One function's working copy: source, trigger, variables, output actions, versions. */
export async function logicFunctionGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required", "blocks logic function get <function-id> [--json]");
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunction({ projectKey, flags, functionId }), flags);
}
