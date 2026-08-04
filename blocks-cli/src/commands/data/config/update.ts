import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataConfigUpdate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      collectionNamePattern: stringFlag(flags, "collection-name-pattern") || undefined,
      connectionString: stringFlag(flags, "connection-string") || undefined,
      databaseName: stringFlag(flags, "database-name") || undefined,
      isCollectionNameEditable: booleanFlag(flags, "collection-name-editable") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined
    })
  };

  if (!body.itemId) throw new Error("Provide --item-id (the existing configuration's id).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/configurations", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Update data source configuration '${body.itemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/configurations", {
    body: { ...body, projectKey },
    impersonatedProjectAuth: true,
    method: "PUT",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function redactSecret(body: Record<string, unknown>): Record<string, unknown> {
  if (!body.connectionString) return body;
  return { ...body, connectionString: "***" };
}
