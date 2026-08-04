import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function storageConfigGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0] || stringFlag(flags, "name", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Storage/Get", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { ConfigurationName: name }
  });
  writeOutput(result, flags);
}
