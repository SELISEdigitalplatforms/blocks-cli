import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../../lib/merge-current.js";
import { redactSecrets } from "../../../lib/redact.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accountPassword: stringFlag(flags, "account-password") || undefined,
      configurationId: stringFlag(flags, "configuration-id") || undefined,
      configurationName: stringFlag(flags, "name") || undefined,
      enableSSL: optionalBooleanFlag(flags, "enable-ssl"),
      host: stringFlag(flags, "host") || undefined,
      isInbound: optionalBooleanFlag(flags, "inbound"),
      port: optionalIntegerFlag(flags, "port"),
      provider: optionalIntegerFlag(flags, "provider"),
      senderAddress: stringFlag(flags, "sender-address") || undefined,
      senderName: stringFlag(flags, "sender-name") || undefined,
      senderUserName: stringFlag(flags, "sender-username") || undefined
    })
  };

  const configurationId = typeof overrides.configurationId === "string" ? overrides.configurationId : undefined;

  // Mail/Save with a configurationId rewrites the configuration from the request. Host,
  // Port, the sender fields and AccountPassword are validated as required, so leaving
  // those out fails loudly -- but EnableSSL, IsInbound and IsEnableSnsConfiguration are
  // non-nullable bools and Provider an enum, so a host-only update silently turned SSL
  // off, flipped an inbound configuration to outbound, reset the provider and dropped
  // the SNS wiring. There is no GET by id; the current record comes from Mail/Gets,
  // which returns the stored MailServerConfiguration
  // ENTITY rather than the request DTO -- its `itemId` is the DTO's `configurationId`
  // and its `name` the DTO's `configurationName`. AccountPassword is not carried: the
  // API returns it masked and storing the mask would break sending, so an update still
  // passes --account-password (which the server requires regardless). A new
  // configuration has nothing to read, so its dry-run stays offline.
  const current = configurationId
    ? carryCurrent(
        findInList(
          await blocksRequest<unknown>("/os/v4/Mail/Gets", {
            impersonatedProjectAuth: true,
            ...requestContext(flags),
            projectTenantId: await selectedProject(flags)
          }),
          (item) => item.itemId === configurationId
        ),
        ["name", "host", "port", "enableSSL", "senderName", "senderAddress", "senderUserName", "isInbound", "provider", "isEnableSnsConfiguration"],
        { name: "configurationName" }
      )
    : {};

  const body = { ...current, ...overrides };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Mail/Save", request: redactSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save mail configuration '${body.configurationName ?? body.configurationId ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Mail/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
