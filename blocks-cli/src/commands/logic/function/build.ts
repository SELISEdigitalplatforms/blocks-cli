import { getBuild, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** One image build: status, resolved packages, and the build log. */
export async function logicFunctionBuild(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = requireId(args[0], "build id", "function_build_id_required", "blocks logic function build <build-id> [--json]");
  const projectKey = await selectedProject(flags);
  writeOutput(await getBuild({ projectKey, flags, buildId }), flags);
}
