import { stringFlag } from "../../../lib/args.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  LOGIC_PROXIES_API,
  readProxyFileBody,
  testProxy
} from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Test a saved proxy or an unsaved draft against the upstream without writing
 * executions or mutating proxy/version data.
 */
export async function logicProxyTest(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const proxyId = args[0];
  const draftFile = stringFlag(flags, "draft-file") || undefined;

  if ((proxyId && draftFile) || (!proxyId && !draftFile)) {
    throw new CliActionableError(
      "Give exactly one of a saved proxy id or --draft-file.",
      "PROXY_VALIDATION",
      "Usage: blocks logic proxy test <proxy-id> --method <verb> …   OR   blocks logic proxy test --draft-file <path.json> --method <verb> …",
      { proxyId: "exactly one of proxyId / draft required", draft: "exactly one of proxyId / draft required" }
    );
  }

  const method = stringFlag(flags, "method");
  if (!method) {
    throw new CliActionableError(
      "Provide --method (one of the proxy's allowed methods).",
      "PROXY_VALIDATION",
      undefined,
      { method: "required" }
    );
  }

  const body: Record<string, unknown> = {
    method: method.toUpperCase(),
    Method: method.toUpperCase(),
    pathSuffix: stringFlag(flags, "path-suffix") || "",
    PathSuffix: stringFlag(flags, "path-suffix") || "",
    query: stringFlag(flags, "query") || "",
    Query: stringFlag(flags, "query") || ""
  };

  const requestBody = stringFlag(flags, "body");
  if (requestBody !== undefined && requestBody !== "") {
    body.body = requestBody;
    body.Body = requestBody;
    const contentType = stringFlag(flags, "content-type") || "application/json";
    body.contentType = contentType;
    body.ContentType = contentType;
  }

  if (proxyId) {
    body.proxyId = proxyId;
    body.ProxyId = proxyId;
  } else if (draftFile) {
    const draft = await readProxyFileBody(draftFile);
    body.draft = draft;
    body.Draft = draft;
  }

  const projectKey = await selectedProject(flags);
  const result = await testProxy({ projectKey, flags, body });
  writeOutput(result ?? { dryRun: false, endpoint: `${LOGIC_PROXIES_API}/test` }, flags);
}
