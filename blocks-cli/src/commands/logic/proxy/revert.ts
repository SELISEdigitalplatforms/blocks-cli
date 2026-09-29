import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { LOGIC_PROXIES_API, revertProxyVersion } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Revert a proxy to a prior version (append-only history). */
export async function logicProxyRevert(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  const versionId = args[1];
  if (!proxyId || !versionId) {
    throw new CliActionableError(
      "Missing proxy id or version id.",
      "proxy_id_required",
      "Usage: blocks logic proxy revert <proxy-id> <version-id> [--yes] [--json]"
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${LOGIC_PROXIES_API}/${proxyId}/versions/${versionId}/revert`,
        method: "POST",
        proxyId,
        versionId
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Revert proxy '${proxyId}' to version '${versionId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await revertProxyVersion({ projectKey, flags, proxyId, versionId });
  writeOutput(result, flags);
}
