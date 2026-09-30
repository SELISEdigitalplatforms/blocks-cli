import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  buildSimpleUpdateOverrides,
  LOGIC_PROXIES_API,
  readProxyFileBody,
  resolveProxyWriteMode,
  updateProxy
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Update a logic proxy with read-before-write merge (Mode A) or full file replace (Mode B). */
export async function logicProxyUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  if (!proxyId) {
    throw new CliActionableError(
      "Missing proxy id.",
      "proxy_id_required",
      "Usage: blocks logic proxy update <proxy-id> (--name/--upstream/--methods | --file) [--yes] [--json]"
    );
  }

  const mode = resolveProxyWriteMode(flags, "update");
  let overrides: Record<string, unknown>;
  let replace = false;
  if (mode.mode === "file" && mode.filePath) {
    overrides = await readProxyFileBody(mode.filePath);
    replace = true;
  } else {
    overrides = buildSimpleUpdateOverrides(flags);
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${LOGIC_PROXIES_API}/${proxyId}`,
        method: "PUT",
        proxyId,
        replace,
        request: overrides
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Update logic proxy '${proxyId}'.`);
  const projectKey = await selectedProject(flags);
  const detail = await updateProxy({
    projectKey,
    flags,
    proxyId,
    overrides,
    replace
  });
  writeOutput(detail, flags);
}
