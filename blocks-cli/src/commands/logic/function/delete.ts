import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { deleteFunction, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Delete a function. The server refuses while runs are active or workflows still
 * have a step pointing at it (FUNCTION_DELETE_BLOCKED); --force deletes anyway.
 */
export async function logicFunctionDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required", "blocks logic function delete <function-id> [--force] --yes [--json]");
  const force = booleanFlag(flags, "force");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/Delete", method: "DELETE", query: { functionId, force } }, flags);
    return;
  }

  await confirmMutation(flags, `Delete function '${functionId}'${force ? " even if workflows still use it" : ""}.`);
  const projectKey = await selectedProject(flags);
  writeOutput(await deleteFunction({ projectKey, flags, functionId, force }), flags);
}
