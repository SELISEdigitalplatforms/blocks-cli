import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataValidationGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const validationId = args[0] || stringFlag(flags, "validation-id", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/data-validations/get-by-id", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { validationId }
  });
  writeOutput(result, flags);
}
