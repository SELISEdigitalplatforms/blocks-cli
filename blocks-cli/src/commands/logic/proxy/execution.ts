import { CliActionableError } from "../../../lib/errors.js";
import { getProxyExecution } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Fetch one execution detail; mismatch/unknown → { data: null } (exit 0). */
export async function logicProxyExecution(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  const executionId = args[1];
  if (!proxyId || !executionId) {
    throw new CliActionableError(
      "Missing proxy id or execution id.",
      "PROXY_VALIDATION",
      "Usage: blocks logic proxy execution <proxy-id> <execution-id> [--json]",
      { proxyId: proxyId ? undefined : "required", executionId: executionId ? undefined : "required" }
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await getProxyExecution({ projectKey, flags, proxyId, executionId });
  writeOutput(result, flags);
}
