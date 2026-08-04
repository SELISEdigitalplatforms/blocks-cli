import { booleanFlag, stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { confirmMutation } from "../../../../lib/confirm.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";

export async function dataRulesPolicyDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "item-id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/data-access/policy/delete", itemId }, flags);
    return;
  }

  await confirmMutation(flags, `Delete data-access policy '${itemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/data-access/policy/delete", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { itemId }
  });
  writeOutput(result, flags);
}
