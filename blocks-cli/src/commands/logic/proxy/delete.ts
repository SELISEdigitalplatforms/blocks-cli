import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { deleteProxy, LOGIC_PROXIES_API } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Hard-delete a logic proxy. Requires --yes (or interactive confirmation). */
export async function logicProxyDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy delete <proxy-id> --yes [--json]"
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${LOGIC_PROXIES_API}/${proxyId}`,
        method: "DELETE",
        proxyId
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Delete logic proxy '${proxyId}'. This cannot be undone.`);
  const projectKey = await selectedProject(flags);
  const result = await deleteProxy({ projectKey, flags, proxyId });
  writeOutput(result, flags);
}
