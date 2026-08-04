import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataSchemaDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/schemas", id }, flags);
    return;
  }

  await confirmMutation(flags, `Delete schema definition '${id}'. This cannot be undone.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/schemas", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { id }
  });
  writeOutput(result, flags);
}
