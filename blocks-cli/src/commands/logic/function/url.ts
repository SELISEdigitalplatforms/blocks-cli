import { stringFlag } from "../../../lib/args.js";
import { isRecord } from "../../../lib/data-response.js";
import { functionInvokeUrl, getFunction, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * The public URL a client calls to invoke a function, with what the deployed
 * trigger accepts: methods, who can call it, and whether it answers synchronously.
 * Callers send the project's tenant id as `x-blocks-key`, plus a Blocks bearer
 * token unless the trigger is Public.
 */
export async function logicFunctionUrl(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required",
    "blocks logic function url <function-id> [--path <sub/path>] [--json]");
  const projectKey = await selectedProject(flags);
  const detail = await getFunction({ projectKey, flags, functionId });
  const trigger = isRecord(detail.trigger) ? detail.trigger : {};
  const listed = Array.isArray(trigger.httpMethods) && trigger.httpMethods.length > 0
    ? trigger.httpMethods.map(String)
    : [String(trigger.httpMethod ?? "Post").toUpperCase()];

  writeOutput({
    functionId,
    url: await functionInvokeUrl(flags, functionId, stringFlag(flags, "path") || undefined),
    xBlocksKey: projectKey,
    methods: listed,
    httpEnabled: trigger.httpEnabled !== false,
    authMode: trigger.authMode ?? "Token",
    responseMode: trigger.responseMode ?? "async",
    deployed: detail.activeVersionId != null,
    note: detail.activeVersionId == null
      ? "Not deployed yet: the URL answers 404 until `blocks logic function deploy` succeeds."
      : "Answers with the deployed version. The trigger shown is the saved one; the live URL uses the settings snapshotted at the last deploy."
  }, flags);
}
