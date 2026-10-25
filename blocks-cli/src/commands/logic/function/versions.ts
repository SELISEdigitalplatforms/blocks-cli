import { getFunctionResource, parseFunctionPaging, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Deployed versions of a function, newest first. */
export async function logicFunctionVersions(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required",
    "blocks logic function versions <function-id> [--page <n>] [--page-size <n>] [--json]");
  const { page, pageSize } = parseFunctionPaging(flags, 20);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetVersions",
    subject: `Function '${functionId}'`,
    query: { functionId, pageNumber: page, pageSize }
  }), flags);
}

/** The source one deployed version was built from (index.js, package.json, lockfile). */
export async function logicFunctionSource(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const usage = "blocks logic function source <function-id> <version-id> [--json]";
  const functionId = requireId(args[0], "function id", "function_id_required", usage);
  const versionId = requireId(args[1], "version id", "function_version_id_required", usage);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetVersionSource",
    subject: `Version '${versionId}' of function '${functionId}'`,
    query: { functionId, versionId }
  }), flags);
}

/** The function's audit trail: create, save, deploy, delete, replay, cancel -- who and when. */
export async function logicFunctionAudit(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const functionId = requireId(args[0], "function id", "function_id_required",
    "blocks logic function audit <function-id> [--page <n>] [--page-size <n>] [--json]");
  const { page, pageSize } = parseFunctionPaging(flags, 50);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({
    projectKey,
    flags,
    action: "GetAuditLog",
    subject: `Function '${functionId}'`,
    query: { functionId, pageNumber: page, pageSize }
  }), flags);
}

/** The fixed resource profile every function runs under (CPU, memory, timeout, concurrency, retries). */
export async function logicFunctionLimits(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  writeOutput(await getFunctionResource({ projectKey, flags, action: "GetLimits", subject: "Function limits" }), flags);
}
