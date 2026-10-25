import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  getFunctionResource,
  parseFunctionPaging,
  pickOne,
  requireId,
  RUN_INVOKED_BY,
  RUN_STATUSES,
  runAction
} from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

function isoFlag(raw: string, flag: string): string | undefined {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new CliActionableError(`--${flag} must be an ISO date/time (got '${raw}').`, "FUNCTION_VALIDATION");
  }
  return parsed.toISOString();
}

/** Runs across the project, or of one function: status, trigger, duration, memory. */
export async function logicFunctionRuns(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = args[0] || stringFlag(flags, "function-id") || undefined;
  const statusRaw = stringFlag(flags, "status");
  const invokedByRaw = stringFlag(flags, "invoked-by");
  const { page, pageSize } = parseFunctionPaging(flags, 20);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetRuns",
    subject: functionId ? `Runs of function '${functionId}'` : "Function runs",
    query: {
      FunctionId: functionId,
      Status: statusRaw ? pickOne(statusRaw, RUN_STATUSES, "status", "FUNCTION_VALIDATION") : undefined,
      InvokedBy: invokedByRaw ? pickOne(invokedByRaw, RUN_INVOKED_BY, "invoked-by", "FUNCTION_VALIDATION") : undefined,
      SearchKey: stringFlag(flags, "search") || undefined,
      FromUtc: isoFlag(stringFlag(flags, "from"), "from"),
      ToUtc: isoFlag(stringFlag(flags, "to"), "to"),
      PageNumber: page,
      PageSize: pageSize
    }
  }), flags);
}

/** One run in full: input, result, error, attempts, output actions, timings. */
export async function logicFunctionRun(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const runId = requireId(args[0], "run id", "function_run_id_required", "blocks logic function run <run-id> [--json]");
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetRun",
    subject: `Run '${runId}'`,
    query: { runId }
  }), flags);
}

/** A run's log lines -- ctx.log and console output, in order. */
export async function logicFunctionLogs(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const runId = requireId(args[0], "run id", "function_run_id_required",
    "blocks logic function logs <run-id> [--page <n>] [--page-size <n>] [--json]");
  const { page, pageSize } = parseFunctionPaging(flags, 200, 1000);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetRunLogs",
    subject: `Run '${runId}'`,
    query: { runId, pageNumber: page, pageSize }
  }), flags);
}

/** Run a past run's input again on the function's current live version. */
export async function logicFunctionReplay(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const runId = requireId(args[0], "run id", "function_run_id_required", "blocks logic function replay <run-id> [--dry-run] [--yes] [--json]");
  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/ReplayRun", method: "POST", request: { runId } }, flags);
    return;
  }
  await confirmMutation(flags, `Replay run '${runId}' (runs the function again, side effects included).`);
  const projectKey = await selectedProject(flags);
  writeOutput(await runAction({ projectKey, flags, action: "ReplayRun", runId }), flags);
}

/** Ask a queued or running run to stop. A finished run is left as it is. */
export async function logicFunctionCancel(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const runId = requireId(args[0], "run id", "function_run_id_required", "blocks logic function cancel <run-id> [--dry-run] [--yes] [--json]");
  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/CancelRun", method: "POST", request: { runId } }, flags);
    return;
  }
  await confirmMutation(flags, `Cancel run '${runId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await runAction({ projectKey, flags, action: "CancelRun", runId });
  writeOutput({ runId, cancelRequested: result.isSuccess !== false }, flags);
}
