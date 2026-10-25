import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  buildSaveBody,
  collectRepeated,
  getFunction,
  parseVariablePairs,
  readSaveSources,
  requireId,
  saveFunction,
  saveHasChanges
} from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Save a function's working copy (Functions/Save). Save replaces source and every
 * piece of configuration at once, so the stored function is read first and only
 * what is supplied -- --dir / single files / function.json / flags -- changes.
 * Saving never changes what runs: the HTTP route and workflow steps keep the
 * deployed version until `logic function deploy`.
 */
export async function logicFunctionSave(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const usage = "blocks logic function save <function-id> [--dir <path>] [--index-file <f>] [--package-file <f>] "
    + "[--lock-file <f>|--no-lock] [--config-file <f>] [--http-methods GET,POST] [--auth public|token] "
    + "[--roles a,b] [--permissions a,b] [--response-mode async|sync] [--http-enabled[=false]] "
    + "[--workflow-enabled[=false]] [--requests-per-minute <n>|default] [--allow-install-scripts[=false]] "
    + "[--var KEY=VALUE]... [--unset-var A,B] [--dry-run] [--yes] [--json]";
  const functionId = requireId(args[0], "function id", "function_id_required", usage);

  const sources = await readSaveSources(flags);
  const variablePairs = parseVariablePairs(collectRepeated(argv, "var"));
  if (!saveHasChanges(sources, flags, variablePairs)) {
    throw new CliActionableError("Nothing to save: pass --dir, a source file, --config-file, or a setting flag.", "function_save_empty", `Usage: ${usage}`);
  }

  const projectKey = await selectedProject(flags);
  const current = await getFunction({ projectKey, flags, functionId });
  const body = buildSaveBody(functionId, current, sources, flags, variablePairs);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/Save", method: "POST", request: redactSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save the working copy of function '${functionId}' (not deployed until 'logic function deploy').`);
  writeOutput(await saveFunction({ projectKey, flags, body }), flags);
}
