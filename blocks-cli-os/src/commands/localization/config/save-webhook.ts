import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationConfigSaveWebhook(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const secret = stringFlag(flags, "secret") || undefined;
  const headerKey = stringFlag(flags, "header-key") || undefined;
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      blocksWebhookSecret: secret || headerKey ? compact({ headerKey, secret }) : undefined,
      contentType: stringFlag(flags, "content-type") || undefined,
      isDisabled: booleanFlag(flags, "is-disabled") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      url: stringFlag(flags, "url") || undefined
    })
  };

  if (!body.url) throw new Error("Provide --url (or set it in --body/--file).");
  if (!body.contentType) throw new Error("Provide --content-type (or set it in --body/--file).");
  if (!body.blocksWebhookSecret) throw new Error("Provide --secret and --header-key (or set blocksWebhookSecret in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Config/SaveWebHook", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save localization webhook '${body.url}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Config/SaveWebHook", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}

function redactSecret(body: Record<string, unknown>): Record<string, unknown> {
  const secret = body.blocksWebhookSecret as Record<string, unknown> | undefined;
  if (!secret?.secret) return body;
  return { ...body, blocksWebhookSecret: { ...secret, secret: "***" } };
}
