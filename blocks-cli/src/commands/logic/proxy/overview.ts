import { CliActionableError } from "../../../lib/errors.js";
import { getProxyOverview } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Rolling-24h / all-time proxy metrics overview, verbatim. */
export async function logicProxyOverview(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy overview <proxy-id> [--json]"
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await getProxyOverview({ projectKey, flags, proxyId });
  writeOutput(result, flags);
}
