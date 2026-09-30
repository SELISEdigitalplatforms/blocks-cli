import { integerFlag, optionalBooleanFlag, stringFlag, zeroBasedPageNumber } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function workflowList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/logic/v4/Workflow/GetAll", {
    body: {
      Search: stringFlag(flags, "search") || undefined,
      IsPublished: optionalBooleanFlag(flags, "is-published"),
      PageNumber: zeroBasedPageNumber(flags),
      PageSize: integerFlag(flags, "page-size", 20)
    },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
