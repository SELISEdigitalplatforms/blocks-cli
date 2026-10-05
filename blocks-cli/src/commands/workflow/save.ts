import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Low-level create/update from a JSON payload. `--item-id` switches Create (POST) to
 * Update (PUT). The body is a workflow graph (`{ name, nodes, edges, settings }`) via
 * `--file`/`--body`; for turning an exported file into a live workflow (with id remap
 * and tenant rewrite) use `workflow import` instead.
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
    writeOutput({
      dryRun: true,
      endpoint: itemId ? "/logic/v4/Workflow/Update" : "/logic/v4/Workflow/Create",
      method: itemId ? "PUT" : "POST",
      request: body
    }, flags);
    return;
  }

  await confirmMutation(flags, `Save workflow '${body.name ?? itemId ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const saveOptions = {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  } as const;
  const result = itemId
    ? await blocksRequest<unknown>("/logic/v4/Workflow/Update", { ...saveOptions, method: "PUT" })
    : await blocksRequest<unknown>("/logic/v4/Workflow/Create", { ...saveOptions, method: "POST" });
  writeOutput(result, flags);
}
