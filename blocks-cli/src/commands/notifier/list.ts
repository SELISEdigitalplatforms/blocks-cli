import { integerFlag, optionalBooleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function notifierList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/logic/v4/Notifier/GetNotifications", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      Filter: stringFlag(flags, "filter") || undefined,
      IsUnreadOnly: optionalBooleanFlag(flags, "unread-only"),
      Page: integerFlag(flags, "page", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      "Sort.IsDescending": optionalBooleanFlag(flags, "sort-desc"),
      "Sort.Property": stringFlag(flags, "sort-by") || undefined
    }
  });
  writeOutput(result, flags);
}
