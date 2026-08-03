import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataValidationBySchemaField(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const schemaId = args[0] || stringFlag(flags, "schema-id", { required: true });
  const fieldName = args[1] || stringFlag(flags, "field-name", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/data-validations/by-schema-and-field", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { fieldName, schemaId }
  });
  writeOutput(result, flags);
}
