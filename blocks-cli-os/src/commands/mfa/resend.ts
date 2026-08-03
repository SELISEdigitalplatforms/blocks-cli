import { stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaResend(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const mfaId = args[0] || stringFlag(flags, "mfa-id", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/resend", {
    body: {
      mfaId,
      sendPhoneNumberAsEmailDomain: stringFlag(flags, "send-phone-number-as-email-domain") || undefined
    },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
