import { optionalIntegerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

// Swagger documents GetUnreadNotificationsBySubscriptionFilter as GET with a JSON
// request body, which the Fetch spec forbids sending on a GET request. Sent as a
// flattened query string instead, matching every other GET endpoint in this API.
export async function notifierUnread(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/logic/v4/Notifier/GetUnreadNotificationsBySubscriptionFilter", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      OrderBy: optionalIntegerFlag(flags, "order-by"),
      "SubscriptionFilterData.ActionName": stringFlag(flags, "action-name") || undefined,
      "SubscriptionFilterData.Context": stringFlag(flags, "context") || undefined,
      "SubscriptionFilterData.Value": stringFlag(flags, "value") || undefined,
      UserId: stringFlag(flags, "user-id") || undefined
    }
  });
  writeOutput(result, flags);
}
