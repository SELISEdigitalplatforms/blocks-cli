import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesDeleteFolder(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const folderId = args[0] || stringFlag(flags, "folder-id", { required: true });
  const body = { folderId, ...compact({ configurationName: stringFlag(flags, "configuration-name") || undefined }) };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/Files/DeleteFolder", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Delete DMS folder '${folderId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/DeleteFolder", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
