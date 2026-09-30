import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function workflowDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Workflow/Delete", method: "DELETE", query: { Id: id } }, flags);
    return;
  }

  await confirmMutation(flags, `Delete workflow '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/logic/v4/Workflow/Delete", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { Id: id }
  });
  writeOutput(result, flags);
}
