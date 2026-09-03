import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

const REPORT_TYPES = new Set(["sast", "sca"]);

/** Security scan report for one build: SAST (SonarQube) or SCA (Dependency-Track). */
export async function releaseReportsGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = args[0] || stringFlag(flags, "build-id", { required: true });
  const type = stringFlag(flags, "type", { required: true }).toLowerCase();
  if (!REPORT_TYPES.has(type)) {
    throw new CliActionableError(
      `--type must be one of: ${[...REPORT_TYPES].join(", ")}.`,
      "invalid_report_type",
      "Re-run with --type sast or --type sca."
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${RELEASE_API}/Build/reports`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { buildId, type },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
