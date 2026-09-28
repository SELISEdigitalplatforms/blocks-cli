import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../lib/merge-current.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function notificationSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      channelToNotify: optionalIntegerFlag(flags, "channel"),
      enablePersistence: optionalBooleanFlag(flags, "enable-persistence"),
      isUpdateRequest: optionalBooleanFlag(flags, "update"),
      name: stringFlag(flags, "name") || undefined,
      notificationType: optionalIntegerFlag(flags, "type"),
      notifyMethod: stringFlag(flags, "notify-method") || undefined
    })
  };

  const projectKey = await selectedProject(flags);

  // Notification/Save upserts by Name and assigns ChannelToNotify, NotificationType and
  // EnablePersistence from the request -- two enums and a bool, all non-nullable -- so
  // re-saving a configuration by name to change one of them reset the other two.
  // Gets has no name filter, so the pages are walked until the name turns up. The
  // match is exact (case included) because the server's own lookup is a Mongo Eq: a
  // differently-cased name is a CREATE there, and carrying another record's fields
  // into it would be wrong.
  const existing = typeof overrides.name === "string" ? await findNotificationByName(overrides.name, projectKey, flags) : undefined;
  const current = carryCurrent(existing, ["channelToNotify", "notificationType", "enablePersistence", "notifyMethod"]);

  // The save validator rejects an already-taken name unless IsUpdateRequest is set, so
  // finding the record IS the update intent -- default it, still overridable by
  // --update=false or --body.
  const body = { ...(existing ? { isUpdateRequest: true } : {}), ...current, ...overrides };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Notification/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save notification configuration '${body.name ?? ""}'.`);
  const result = await blocksRequest<unknown>("/os/v4/Notification/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

async function findNotificationByName(
  name: string,
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<Record<string, unknown> | undefined> {
  const pageSize = 100;
  // The repository skips PageSize * Page, so the first page is 0. A short page means
  // the list is exhausted; the cap only guards against a server that never returns one.
  for (let page = 0; page < 50; page += 1) {
    const response = await blocksRequest<unknown>("/os/v4/Notification/Gets", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { Page: page, PageSize: pageSize }
    });
    const match = findInList(response, (item) => item.name === name);
    if (match) return match;
    if (countRows(response) < pageSize) return undefined;
  }
  return undefined;
}

function countRows(response: unknown): number {
  if (Array.isArray(response)) return response.length;
  if (!response || typeof response !== "object") return 0;
  const list = Object.values(response as Record<string, unknown>).find(Array.isArray);
  return Array.isArray(list) ? list.length : 0;
}
