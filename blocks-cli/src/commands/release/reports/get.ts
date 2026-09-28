import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

// TestReportService.GetReport's switch in blocks-release: anything else logs "unknown
// type" server-side and returns a null report with isSuccess true, so validate here.
const REPORT_TYPES = new Set(["sast", "sca-container", "sca-libraries", "dast"]);

/**
 * Security scan report for one build: SAST (SonarQube), SCA (Dependency-Track, split
 * into the container image and the library manifest scans), or DAST.
 */
export async function releaseReportsGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = args[0] || stringFlag(flags, "build-id", { required: true });
  const type = stringFlag(flags, "type", { required: true }).toLowerCase();
  if (!REPORT_TYPES.has(type)) {
    throw new CliActionableError(
      `--type must be one of: ${[...REPORT_TYPES].join(", ")}.`,
      "invalid_report_type",
      "Re-run with --type sast, --type sca-container, --type sca-libraries, or --type dast."
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
