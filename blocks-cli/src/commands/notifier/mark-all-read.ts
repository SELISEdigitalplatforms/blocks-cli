import { booleanFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const NOTIFIER_MARK_ALL_READ_API = "/logic/v4/Notifier/MarkAllNotificationAsRead";

export async function notifierMarkAllRead(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: NOTIFIER_MARK_ALL_READ_API }, flags);
    return;
  }

  await confirmMutation(flags, "Mark all notifications as read.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(NOTIFIER_MARK_ALL_READ_API, {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
