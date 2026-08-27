import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { redactSecrets } from "../../../lib/redact.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
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
