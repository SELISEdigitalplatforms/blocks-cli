import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyDeleteKeys(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemIds = listFlag(flags, "item-ids") ?? args;
  if (!itemIds.length) throw new Error("Provide key ids as arguments or --item-ids a,b.");

  const body = { itemIds };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/DeleteKeys", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Delete ${itemIds.length} localization key(s).`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/DeleteKeys", {
    body,
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
