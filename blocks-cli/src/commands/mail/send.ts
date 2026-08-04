import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag, jsonFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const MAIL_SEND_API = "/logic/v4/Mail/Send";

export async function mailSend(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      attachments: jsonFlag(flags, "attachments"),
      bcc: listFlag(flags, "bcc"),
      bodyDataContext: jsonFlag(flags, "body-data-context"),
      cc: listFlag(flags, "cc"),
      language: stringFlag(flags, "language") || undefined,
      projectKey: stringFlag(flags, "project-key") || projectKey,
      purpose: stringFlag(flags, "purpose") || undefined,
      replyTo: listFlag(flags, "reply-to"),
      sendPhoneNumberAsEmail: booleanFlag(flags, "send-phone-number-as-email") || undefined,
      subjectDataContext: jsonFlag(flags, "subject-data-context"),
      to: listFlag(flags, "to")
    })
  } as { to?: string[] };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: MAIL_SEND_API, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Send mail to ${(body.to ?? []).join(", ") || "recipient(s)"}.`);
  const result = await blocksRequest<unknown>(MAIL_SEND_API, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
