import { booleanFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function dataReload(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, projectKey, endpoint: "/data/v4/schema-configurations/reload" }, flags);
    return;
  }
  await confirmMutation(flags, `Reload data gateway schema for project '${projectKey}'.`);
  const result = await blocksRequest<unknown>("/data/v4/schema-configurations/reload", {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
