import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { isRecord } from "../../lib/data-response.js";
import { CliActionableError, withPermissionHint } from "../../lib/errors.js";
import { compact, jsonBodyFlag, jsonFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { optionalSelectedProject, parseCommand, selectedProject } from "../../lib/workspace.js";

const NOTIFIER_NOTIFY_API = "/logic/v4/Notifier/Notify";

export const NOTIFIER_SEND_PERMISSION = "blocks-logic::notifier::send";

/**
 * Values for the request fields blocks-logic binds as required strings but a
 * server-side send has no use for: `connectionId` is the sender's own SignalR
 * connection, `responseKey`/`responseValue` are labels stored on the notification.
 */
export const NOTIFY_FIELD_DEFAULTS = { connectionId: "server", responseKey: "notification", responseValue: "notification" } as const;

/**
 * Send a notification through blocks-logic's Notifier.
 *
 * Since blocks-logic 2026-10-24 a send needs the services' internal `Secret` header or a token
 * with `blocks-logic::notifier::send`; an anonymous call is refused. The CLI sends with its
 * impersonated project session. blocks-logic still resolves `configurationName` in the ROOT
 * database for an impersonated caller (Notification ConfigurationRepository), so a project's
 * own configuration comes back `no_configuration_exist` until that is fixed server-side; the
 * error below says so instead of claiming the project has no such configuration.
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
  // A send without the permission is answered 401 (NotifierController.Refused), not 403.
  const result = await withPermissionHint(NOTIFIER_SEND_PERMISSION, blocksRequest<unknown>(NOTIFIER_NOTIFY_API, {
    acceptFailureEnvelope: true,
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  }), [401, 403]);
  if (isRecord(result) && result.isSuccess === false) {
    const errors = isRecord(result.errors) ? result.errors : {};
    if (errors.ConfigurationName === "no_configuration_exist") {
      const names = projectKey ? (await configurationNames(projectKey, flags)) : [];
      if (names.includes(String(body.configurationName))) {
        throw new CliActionableError(
          `The project has '${String(body.configurationName)}', but blocks-logic looks configurations up in the root project for a CLI (impersonated) send, so it cannot be sent from the CLI yet.`,
          "notify_impersonation_unsupported",
          "Send it from the app with @seliseblocks/client (blocks.notifier.notify) as a user whose role has blocks-logic::notifier::send.",
          errors
        );
      }
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
  const names = await configurationNames(projectKey, flags);
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

/** The names of the project's notification configurations (blocks-os, first 50). */
async function configurationNames(projectKey: string, flags: Record<string, string | boolean>): Promise<string[]> {
  const response = await blocksRequest<unknown>("/os/v4/Notification/Gets", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { Page: 0, PageSize: 50 }
  });
  return (isRecord(response) && Array.isArray(response.configurations) ? response.configurations : [])
    .filter(isRecord)
    .map((configuration) => configuration.name)
    .filter((name): name is string => typeof name === "string" && name.length > 0);
}
