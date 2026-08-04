import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag, jsonFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const NOTIFIER_NOTIFY_API = "/logic/v4/Notifier/Notify";

export async function notifierNotify(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      connectionId: stringFlag(flags, "connection-id") || undefined,
      contentAvailable: booleanFlag(flags, "content-available") || undefined,
      denormalizedPayload: stringFlag(flags, "denormalized-payload") || undefined,
      responseKey: stringFlag(flags, "response-key") || undefined,
      responseValue: stringFlag(flags, "response-value") || undefined,
      roles: listFlag(flags, "roles"),
      saveDenormalizedPayloadAsAnObject: booleanFlag(flags, "save-denormalized-payload-as-object") || undefined,
      subscriptionFilters: jsonFlag(flags, "subscription-filters"),
      userIds: listFlag(flags, "user-ids")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: NOTIFIER_NOTIFY_API, request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Send notification.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(NOTIFIER_NOTIFY_API, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
