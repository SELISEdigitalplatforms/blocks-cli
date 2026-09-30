import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";
import { unwrapWorkflow } from "../../lib/workflow-graph.js";

/**
 * Publish a new version, which is what actually activates a workflow: its webhook
 * becomes reachable and any schedule triggers are registered. A freshly created or
 * imported workflow stays inactive (IsPublished=false) until this runs.
 */
export async function workflowPublish(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const projectKey = await selectedProject(flags);

  // PublishNewVersion requires a name; default to the workflow's current name.
  let name = stringFlag(flags, "name");
  if (!name) {
    const current = unwrapWorkflow(await blocksRequest<unknown>("/logic/v4/Workflow/Get", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { WorkflowId: id }
    }));
    name = typeof current.name === "string" ? current.name : id;
  }

  const body = { workflowId: id, name, description: stringFlag(flags, "description") || undefined };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Workflow/PublishNewVersion", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Publish workflow '${name}' (${id}). It will start running.`);
  const result = await blocksRequest<unknown>("/logic/v4/Workflow/PublishNewVersion", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
