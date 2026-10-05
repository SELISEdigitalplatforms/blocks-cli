import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import {
  buildSimpleCreateBody,
  createProxy,
  LOGIC_PROXIES_API,
  readProxyFileBody,
  resolveProxyWriteMode
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Create a logic proxy (Mode A simple flags or Mode B --file). */
export async function logicProxyCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const mode = resolveProxyWriteMode(flags, "create");

  let body: Record<string, unknown>;
  if (mode.mode === "file" && mode.filePath) {
    body = await readProxyFileBody(mode.filePath);
  } else {
    body = buildSimpleCreateBody(flags);
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: LOGIC_PROXIES_API, method: "POST", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create logic proxy '${String(body.name ?? "(from file)")}'.`);
  const projectKey = await selectedProject(flags);
  const detail = await createProxy({ projectKey, flags, body });
  writeOutput(detail, flags);
}
