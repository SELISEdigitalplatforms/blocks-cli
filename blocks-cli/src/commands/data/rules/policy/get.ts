import { stringFlag } from "../../../../lib/args.js";
import { blocksRequest } from "../../../../lib/api.js";
import { writeOutput } from "../../../../lib/output.js";
import { requestContext } from "../../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../../lib/workspace.js";

export async function dataRulesPolicyGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const schemaName = args[0] || stringFlag(flags, "schema-name", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/data/v4/data-access/policy/get", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { schemaName }
  });
  writeOutput(result, flags);
}
