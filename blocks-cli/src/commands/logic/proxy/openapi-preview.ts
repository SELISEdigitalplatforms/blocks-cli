import { readFile } from "node:fs/promises";
import { stringFlag } from "../../../lib/args.js";
import { CliActionableError } from "../../../lib/errors.js";
import { previewOpenApi } from "../../../lib/logic-proxy.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Preview the proxy routes an OpenAPI 3 document would produce. Read-only: pick the
 * operations you want and send them as `routes` through `logic proxy create|update --file`.
 */
export async function logicProxyOpenApiPreview(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const usage = "blocks logic proxy openapi-preview (--spec-file <openapi.json> | --spec-url <https://…>) [--proxy-id <id>] [--json]";
  const specFile = stringFlag(flags, "spec-file");
  const specUrl = stringFlag(flags, "spec-url");
  if (Boolean(specFile) === Boolean(specUrl)) {
    throw new CliActionableError("Give exactly one of --spec-file or --spec-url.", "PROXY_VALIDATION", `Usage: ${usage}`);
  }

  let specJson: string | undefined;
  if (specFile) {
    try {
      specJson = await readFile(specFile, "utf8");
    } catch (error) {
      throw new CliActionableError(
        `Cannot read --spec-file ${specFile}: ${error instanceof Error ? error.message : String(error)}`,
        "proxy_file_unreadable"
      );
    }
  }

  const projectKey = await selectedProject(flags);
  writeOutput(await previewOpenApi({
    projectKey,
    flags,
    specJson,
    specUrl: specUrl || undefined,
    proxyId: stringFlag(flags, "proxy-id") || undefined
  }), flags);
}
