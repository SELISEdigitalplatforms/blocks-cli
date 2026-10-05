import { CliActionableError } from "../../../lib/errors.js";
import {
  listProxyVersions,
  parseProxyPageSize,
  parseZeroBasedPage
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** List proxy version history (newest first), verbatim. */
export async function logicProxyVersions(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy versions <proxy-id> [--page <n>] [--page-size <n>] [--json]"
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await listProxyVersions({
    projectKey,
    flags,
    proxyId,
    page: parseZeroBasedPage(flags),
    pageSize: parseProxyPageSize(flags, 50)
  });
  writeOutput(result, flags);
}
