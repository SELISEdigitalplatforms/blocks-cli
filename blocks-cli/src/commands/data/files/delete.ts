import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = args[0] || stringFlag(flags, "file-id", { required: true });
  const permanent = booleanFlag(flags, "permanent");
  const body = { fileId, permanent, ...compact({
    configurationName: stringFlag(flags, "configuration-name") || undefined,
    eventQueueName: stringFlag(flags, "event-queue-name") || undefined
  }) };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/files/delete-file", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `${permanent ? "Permanently delete" : "Move"} file '${fileId}'${permanent ? "" : " to trash"}.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/files/delete-file", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
