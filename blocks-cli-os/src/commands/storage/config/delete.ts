import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function storageConfigDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0] || stringFlag(flags, "name", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Storage/Delete", query: { ConfigurationName: name } }, flags);
    return;
  }

  await confirmMutation(flags, `Delete storage configuration '${name}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Storage/Delete", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { ConfigurationName: name }
  });
  writeOutput(result, flags);
}
