import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesGetMany(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileIds = listFlag(flags, "file-ids") ?? args;
  if (!fileIds.length) throw new Error("Provide file ids as arguments or --file-ids a,b.");

  const body = compact({
    configurationName: stringFlag(flags, "configuration-name") || undefined,
    fileIds
  });

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/GetFiles", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
