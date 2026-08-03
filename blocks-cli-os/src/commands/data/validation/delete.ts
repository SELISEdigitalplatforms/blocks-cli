import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataValidationDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const validationId = args[0] || stringFlag(flags, "validation-id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/data-validations", validationId }, flags);
    return;
  }

  await confirmMutation(flags, `Delete data validation '${validationId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/data-validations", {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { validationId }
  });
  writeOutput(result, flags);
}
