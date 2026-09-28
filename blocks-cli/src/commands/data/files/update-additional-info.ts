import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesUpdateAdditionalInfo(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const itemId = args[0] || stringFlag(flags, "item-id", { required: true });
  const additionalPropertiesRaw = stringFlag(flags, "additional-properties", { required: true });
  const additionalProperties = JSON.parse(additionalPropertiesRaw) as Record<string, string>;
  const body = { additionalProperties, itemId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/files/update-file-additional-info", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update additional info for file '${itemId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/files/update-file-additional-info", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
