import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function notificationSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      channelToNotify: optionalIntegerFlag(flags, "channel"),
      enablePersistence: booleanFlag(flags, "enable-persistence") || undefined,
      isUpdateRequest: booleanFlag(flags, "update") || undefined,
      name: stringFlag(flags, "name") || undefined,
      notificationType: optionalIntegerFlag(flags, "type"),
      notifyMethod: stringFlag(flags, "notify-method") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Notification/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save notification configuration '${body.name ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Notification/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
