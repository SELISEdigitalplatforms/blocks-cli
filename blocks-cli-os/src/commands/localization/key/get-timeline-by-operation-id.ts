import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetTimelineByOperationId(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const operationId = args[0] || stringFlag(flags, "operation-id", { required: true });
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetTimelineByOperationId", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: {
      OperationId: operationId,
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20)
    }
  });
  writeOutput(result, flags);
}
