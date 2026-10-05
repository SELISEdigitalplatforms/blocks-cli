import { CliActionableError } from "../../../lib/errors.js";
import { getProxy } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Fetch one proxy; unknown/foreign id returns { data: null } (exit 0). */
export async function logicProxyGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy get <proxy-id> [--json]"
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await getProxy({ proxyId, projectKey, flags });
  writeOutput(result, flags);
}
