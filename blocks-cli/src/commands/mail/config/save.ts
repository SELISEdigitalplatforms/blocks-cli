import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../../lib/merge-current.js";
import { redactSecrets } from "../../../lib/redact.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

// MailServiceProvider in blocks-os (Configuration.DomainService/Shared/Enums). The API
// binds the ordinal; names are accepted so a script doesn't depend on the ordering.
const PROVIDERS: Record<string, number> = { amazonses: 0, ses: 0, zoho: 1, office365smtp: 2, office365: 2 };

// MailSecurityMode. Legacy defers to EnableSSL; Office 365 is always normalized to StartTls.
const SECURITY_MODES: Record<string, number> = { legacy: 0, none: 1, starttls: 2, sslonconnect: 3 };

export async function mailConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accountPassword: stringFlag(flags, "account-password") || undefined,
      clientId: stringFlag(flags, "client-id") || undefined,
      clientSecret: stringFlag(flags, "client-secret") || undefined,
      configurationId: stringFlag(flags, "configuration-id") || undefined,
      configurationName: stringFlag(flags, "name") || undefined,
      enableSSL: optionalBooleanFlag(flags, "enable-ssl"),
      host: stringFlag(flags, "host") || undefined,
      isInbound: optionalBooleanFlag(flags, "inbound"),
      mailboxAddress: stringFlag(flags, "mailbox-address") || undefined,
      port: optionalIntegerFlag(flags, "port"),
      provider: enumFlag(flags, "provider", PROVIDERS),
      securityMode: enumFlag(flags, "security-mode", SECURITY_MODES),
      senderAddress: stringFlag(flags, "sender-address") || undefined,
      senderName: stringFlag(flags, "sender-name") || undefined,
      senderUserName: stringFlag(flags, "sender-username") || undefined,
      // The Microsoft Entra tenant the Office 365 app is registered in -- not the Blocks
      // tenant, which the server takes from the token and never from a request field.
      tenantId: stringFlag(flags, "entra-tenant-id") || undefined
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
  // projection rather than the request DTO -- its `itemId` is the DTO's `configurationId`
  // and its `name` the DTO's `configurationName`. AccountPassword is not carried: the
  // API returns it masked and storing the mask would break sending, so an update of a
  // password provider (Amazon SES, Zoho) still passes --account-password. Office 365
  // takes no password; its client secret is never returned either, and leaving
  // --client-secret out of an edit keeps the stored one. The server refuses a change of
  // provider or direction on an existing record. A new configuration has nothing to
  // read, so its dry-run stays offline.
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
        [
          "name", "host", "port", "enableSSL", "senderName", "senderAddress", "senderUserName", "isInbound", "provider",
          "isEnableSnsConfiguration", "authenticationType", "securityMode", "tenantId", "clientId", "mailboxAddress"
        ],
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

function enumFlag(flags: Record<string, string | boolean>, name: string, values: Record<string, number>): number | undefined {
  const raw = stringFlag(flags, name);
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  const value = values[raw.toLowerCase().replace(/[-_\s]/g, "")];
  if (value === undefined) throw new Error(`--${name} must be one of ${Object.keys(values).join(", ")} (or the raw number)`);
  return value;
}
