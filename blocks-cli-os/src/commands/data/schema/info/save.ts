import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { confirmMutation } from "../../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../../lib/json-flag.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";

export async function dataSchemaInfoSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      collectionName: stringFlag(flags, "collection-name") || undefined,
      schemaName: stringFlag(flags, "schema-name") || undefined,
      schemaType: optionalIntegerFlag(flags, "schema-type")
    })
  };

  if (!body.schemaName) throw new Error("Provide --schema-name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/schemas/info", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create schema '${body.schemaName}' (metadata only - use 'data:schema:fields' to add fields).`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/schemas/info", {
    body,
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
