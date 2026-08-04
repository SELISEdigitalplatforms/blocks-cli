import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesCreateFolder(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const artifactName = args[0] || stringFlag(flags, "name", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      artifactName,
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      description: stringFlag(flags, "description") || undefined,
      parentId: stringFlag(flags, "parent-id"),
      tags: listFlag(flags, "tags")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/Files/CreateFolder", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create DMS folder '${artifactName}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/CreateFolder", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
