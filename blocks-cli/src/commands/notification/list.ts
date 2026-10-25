import { integerFlag, optionalBooleanFlag, stringFlag, zeroBasedPage } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function notificationList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Notification/Gets", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      Filter: stringFlag(flags, "filter") || undefined,
      // Notification/Gets skips PageSize * Page: the 1-based --page is converted, or the
      // default page skipped the first configurations.
      Page: zeroBasedPage(flags),
      PageSize: integerFlag(flags, "page-size", 20),
      "Sort.IsDescending": optionalBooleanFlag(flags, "sort-desc"),
      "Sort.Property": stringFlag(flags, "sort-by") || undefined
    }
  });
  writeOutput(result, flags);
}
