import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { LOGIC_PROXIES_API, toggleProxy } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function logicProxyEnable(argv: string[]): Promise<void> {
  await setProxyEnabled(argv, true);
}

export async function logicProxyDisable(argv: string[]): Promise<void> {
  await setProxyEnabled(argv, false);
}

async function setProxyEnabled(argv: string[], enabled: boolean): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  const verb = enabled ? "enable" : "disable";
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      `Usage: blocks logic proxy ${verb} <proxy-id> [--yes] [--json]`
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${LOGIC_PROXIES_API}/${proxyId}`,
        method: "PATCH",
        request: { itemId: proxyId, enabled }
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `${enabled ? "Enable" : "Disable"} logic proxy '${proxyId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await toggleProxy({ projectKey, flags, proxyId, enabled });
  writeOutput(result, flags);
}
