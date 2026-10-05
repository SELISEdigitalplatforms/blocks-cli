import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Take a workflow out of service: its webhook stops responding and any schedule
 * triggers are removed. The workflow and its draft are kept; re-publish to reactivate.
 */
export async function workflowUnpublish(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Workflow/Unpublish", request: { workflowId: id } }, flags);
    return;
  }

  await confirmMutation(flags, `Unpublish workflow '${id}'. It will stop running.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/logic/v4/Workflow/Unpublish", {
    body: { workflowId: id },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
