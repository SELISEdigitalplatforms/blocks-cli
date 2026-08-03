import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = args[0] || stringFlag(flags, "file-id", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/Files/GetFile", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      ConfigurationName: stringFlag(flags, "configuration-name") || undefined,
      FileId: fileId,
      Version: integerFlag(flags, "version", 0) || undefined
    }
  });
  writeOutput(result, flags);
}
