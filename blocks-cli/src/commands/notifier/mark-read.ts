import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const NOTIFIER_MARK_READ_API = "/logic/v4/Notifier/MarkNotificationAsRead";

export async function notifierMarkRead(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: NOTIFIER_MARK_READ_API, request: { id } }, flags);
    return;
  }

  await confirmMutation(flags, `Mark notification '${id}' as read.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(NOTIFIER_MARK_READ_API, {
    body: { id },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
