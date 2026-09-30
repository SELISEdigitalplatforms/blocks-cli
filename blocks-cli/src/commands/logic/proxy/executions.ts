import { stringFlag } from "../../../lib/args.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  listProxyExecutions,
  parseProxyPageSize,
  parseZeroBasedPage
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

const STATUS_CLASSES = new Set(["all", "2xx", "4xx", "5xx"]);

/** List recent proxy executions (rolling 24h), with optional live-tail --after-id. */
export async function logicProxyExecutions(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy executions <proxy-id> [--status-class all|2xx|4xx|5xx] [--after-id <id>] [--page <n>] [--page-size <n>] [--as-of <ISO>] [--json]"
    );
  }

  const statusClassRaw = stringFlag(flags, "status-class") || "all";
  const statusClass = statusClassRaw.toLowerCase();
  if (!STATUS_CLASSES.has(statusClass)) {
    // Fail before the request so we never silently default — ticket C8 also
    // accepts a server PROXY_VALIDATION; client-side keeps agents fast.
    throw new CliActionableError(
      `'${statusClassRaw}' is not a valid --status-class. Use all, 2xx, 4xx, or 5xx.`,
      "PROXY_VALIDATION",
      undefined,
      { statusClass: "must be all|2xx|4xx|5xx" }
    );
  }

  const afterId = stringFlag(flags, "after-id") || undefined;
  const asOf = stringFlag(flags, "as-of") || undefined;
  const projectKey = await selectedProject(flags);
  const result = await listProxyExecutions({
    projectKey,
    flags,
    proxyId,
    statusClass,
    afterId,
    page: afterId ? 0 : parseZeroBasedPage(flags),
    pageSize: parseProxyPageSize(flags, 25),
    asOf
  });
  writeOutput(result, flags);
}
