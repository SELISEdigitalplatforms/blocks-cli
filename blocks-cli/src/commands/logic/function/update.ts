import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { getFunction, requireId, updateFunction } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Rename / re-describe a function. Functions/Update takes name and description
 * together, so the one not passed is read from the stored function first.
 */
export async function logicFunctionUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const usage = "blocks logic function update <function-id> [--name <n>] [--description <d>] [--dry-run] [--yes] [--json]";
  const functionId = requireId(args[0], "function id", "function_id_required", usage);
  const name = stringFlag(flags, "name").trim();
  const hasDescription = typeof flags.description === "string";
  if (!name && !hasDescription) {
    throw new CliActionableError("Provide --name and/or --description.", "function_update_empty", `Usage: ${usage}`);
  }

  const projectKey = await selectedProject(flags);
  const current = await getFunction({ projectKey, flags, functionId });
  const body = {
    functionId,
    name: name || String(current.name ?? ""),
    description: hasDescription ? stringFlag(flags, "description") : (current.description ?? null)
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/Update", method: "POST", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update function '${functionId}'.`);
  writeOutput(await updateFunction({ projectKey, flags, body }), flags);
}
