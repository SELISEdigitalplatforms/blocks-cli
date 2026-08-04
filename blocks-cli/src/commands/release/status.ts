import { stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function releaseStatus(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const buildId = args[0] || stringFlag(flags, "build-id", { required: true });
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/release/v4/api/Build", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { buildId }
  });
  writeOutput(result, flags);
}
