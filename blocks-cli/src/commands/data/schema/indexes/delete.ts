import { booleanFlag, stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { confirmMutation } from "../../../../lib/confirm.js";
import { CliActionableError } from "../../../../lib/errors.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";
import { withGatewayReload } from "../../../../lib/data-gateway.js";

const ENDPOINT = "/data/v4/schemas/indexes";

export async function dataSchemaIndexesDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "item-id", { required: true });

  // systemIndexes carry a synthetic "system:<field>_2dsphere" id with no stored
  // definition, so the server would only answer INDEX_NOT_FOUND.
  if (itemId.startsWith("system:")) {
    throw new CliActionableError(
      `'${itemId}' is a system-managed GeoJson index and cannot be deleted.`,
      "system_index_not_deletable",
      "It is dropped automatically when its GeoJson field is deleted or changes type ('blocks data schema fields')."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: ENDPOINT, itemId }, flags);
    return;
  }

  await confirmMutation(flags, `Delete schema index '${itemId}' (drops the MongoDB index).`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(ENDPOINT, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { itemId }
  });
  writeOutput(await withGatewayReload(flags, projectKey, result), flags);
}
