import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { isRecord } from "../../lib/data-response.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact, jsonBodyFlag, jsonFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { optionalSelectedProject, parseCommand, selectedProject } from "../../lib/workspace.js";

const NOTIFIER_NOTIFY_API = "/logic/v4/Notifier/Notify";

/**
 * Values for the request fields blocks-logic binds as required strings but a
 * server-side send has no use for: `connectionId` is the sender's own SignalR
 * connection, `responseKey`/`responseValue` are labels stored on the notification.
 */
export const NOTIFY_FIELD_DEFAULTS = { connectionId: "server", responseKey: "notification", responseValue: "notification" } as const;

/**
 * Send a notification through blocks-logic's Notifier.
 *
 * Sent anonymously with only the project's `x-blocks-key`, like the app SDK sends it.
 * Notify is an anonymous action, and blocks-logic resolves `configurationName` in the
 * root database for an impersonated caller -- so with the CLI's impersonated token every
 * project configuration came back `no_configuration_exist`.
 */
export async function notifierNotify(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  const body: Record<string, unknown> = {
    ...NOTIFY_FIELD_DEFAULTS,
    ...(await jsonBodyFlag(flags)),
    ...compact({
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      connectionId: stringFlag(flags, "connection-id") || undefined,
      contentAvailable: booleanFlag(flags, "content-available") || undefined,
      denormalizedPayload: stringFlag(flags, "denormalized-payload") || undefined,
      organizationIds: listFlag(flags, "organization-ids"),
      responseKey: stringFlag(flags, "response-key") || undefined,
      responseValue: stringFlag(flags, "response-value") || undefined,
      roles: listFlag(flags, "roles"),
      saveDenormalizedPayloadAsAnObject: booleanFlag(flags, "save-denormalized-payload-as-object") || undefined,
      subscriptionFilters: jsonFlag(flags, "subscription-filters"),
      userIds: listFlag(flags, "user-ids")
    })
  };

  const hasTarget = ["userIds", "roles", "organizationIds", "subscriptionFilters"]
    .some((key) => Array.isArray(body[key]) && (body[key] as unknown[]).length > 0);
  if (!hasTarget) {
    throw new CliActionableError(
      "Name who receives it: --user-ids, --roles, --organization-ids or --subscription-filters.",
      "notify_target_required"
    );
  }
  if (typeof body.denormalizedPayload !== "string" || !body.denormalizedPayload) {
    throw new CliActionableError(
      "Provide --denormalized-payload (the notification content, usually a JSON string).",
      "notify_payload_required"
    );
  }

  // A dry-run with a configuration name needs no project; without one, the project's
  // configurations are read to pick the only one -- when no project resolves, the plan says so.
  const dryRun = booleanFlag(flags, "dry-run");
  const projectKey = dryRun ? await optionalSelectedProject(flags) : await selectedProject(flags);
  let resolvedConfiguration: string | undefined;
  if (!body.configurationName && projectKey) {
    resolvedConfiguration = await soleConfigurationName(projectKey, flags);
    body.configurationName = resolvedConfiguration;
  }

  if (dryRun) {
    writeOutput({
      dryRun: true,
      endpoint: NOTIFIER_NOTIFY_API,
      request: body,
      ...(resolvedConfiguration ? { configurationResolvedFrom: "the project's only notification configuration" } : {}),
      ...(!body.configurationName ? { configurationResolvedFrom: "pending: no project selected; resolved from the project's notification configurations when sent" } : {})
    }, flags);
    return;
  }
  await confirmMutation(flags, `Send notification through configuration '${String(body.configurationName)}'.`);
  const result = await blocksRequest<unknown>(NOTIFIER_NOTIFY_API, {
    acceptFailureEnvelope: true,
    anonymousTenantId: projectKey,
    body,
    ...requestContext(flags)
  });
  if (isRecord(result) && result.isSuccess === false) {
    const errors = isRecord(result.errors) ? result.errors : {};
    if (errors.ConfigurationName === "no_configuration_exist") {
      throw new CliActionableError(
        `No notification configuration named '${String(body.configurationName)}' in this project.`,
        "notification_configuration_not_found",
        "blocks notification list --json, then pass its `name` as --configuration-name.",
        errors
      );
    }
    throw new CliActionableError("The notifier refused the notification.", "notify_failed", undefined, errors);
  }
  writeOutput(result, flags);
}

/** The project's notification configuration name when it has exactly one; otherwise an actionable error. */
async function soleConfigurationName(projectKey: string, flags: Record<string, string | boolean>): Promise<string> {
  const response = await blocksRequest<unknown>("/os/v4/Notification/Gets", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { Page: 0, PageSize: 50 }
  });
  const names = (isRecord(response) && Array.isArray(response.configurations) ? response.configurations : [])
    .filter(isRecord)
    .map((configuration) => configuration.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);

  if (names.length === 1) return names[0];
  if (names.length === 0) {
    throw new CliActionableError(
      "This project has no notification configuration, and a send needs one.",
      "notification_configuration_required",
      "Create one with `blocks notification save --name <n> --channel <0|1> --type <0-3> --dry-run --json`, then pass --configuration-name <n>."
    );
  }
  throw new CliActionableError(
    `Pass --configuration-name: this project has ${names.length} notification configurations (${names.join(", ")}).`,
    "notification_configuration_required"
  );
}
