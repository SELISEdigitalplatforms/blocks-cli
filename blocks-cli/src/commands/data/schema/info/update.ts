import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { confirmMutation } from "../../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../../lib/json-flag.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";

export async function dataSchemaInfoUpdate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      collectionName: stringFlag(flags, "collection-name") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      schemaName: stringFlag(flags, "schema-name") || undefined,
      schemaType: optionalIntegerFlag(flags, "schema-type")
    })
  };

  if (!body.itemId) throw new Error("Provide --item-id (the existing schema's itemId).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/schemas/info", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update schema '${body.itemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/schemas/info", {
    body,
    impersonatedProjectAuth: true,
    method: "PUT",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
