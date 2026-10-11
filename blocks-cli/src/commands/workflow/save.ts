import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { createWorkflow, planWorkflowCreate } from "../../lib/workflow-create.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Low-level create/update from a JSON payload. `--item-id` switches Create (POST) to
 * Update (PUT). The body is a workflow graph (`{ name, nodes, edges, settings }`) via
 * `--file`/`--body`; for turning an exported file into a live workflow (with id remap
 * and tenant rewrite) use `workflow import` instead. A create with nodes is sent as an
 * empty Create followed by an Update, because Create 500s on any node parameters
 * (see lib/workflow-create.ts).
 */
export async function workflowSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const itemId = stringFlag(flags, "item-id") || undefined;
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      itemId,
      name: stringFlag(flags, "name") || undefined,
      description: stringFlag(flags, "description") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    if (itemId) {
      writeOutput({ dryRun: true, endpoint: "/logic/v4/Workflow/Update", method: "PUT", request: body }, flags);
    } else {
      const plan = planWorkflowCreate(body);
      writeOutput({
        dryRun: true,
        endpoint: plan.create.endpoint,
        method: plan.create.method,
        request: plan.create.request,
        ...(plan.update ? { then: { ...plan.update, request: { itemId: "<created id>", ...plan.update.request } } } : {})
      }, flags);
    }
    return;
  }

  await confirmMutation(flags, `Save workflow '${body.name ?? itemId ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const context = { ...requestContext(flags), projectTenantId: projectKey };
  const result = itemId
    ? await blocksRequest<unknown>("/logic/v4/Workflow/Update", {
      body,
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      method: "PUT"
    })
    : (await createWorkflow(body, context)).response;
  writeOutput(result, flags);
}
