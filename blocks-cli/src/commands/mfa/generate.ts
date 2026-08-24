import { optionalIntegerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaGenerate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  // optionalIntegerFlag, not `integerFlag(...) || Number(args[0])`: mfaType 0 (None) is a
  // valid enum value, and `0 || ...` silently fell through to the missing positional.
  const mfaType = optionalIntegerFlag(flags, "mfa-type") ?? Number(args[0]);
  if (!Number.isInteger(mfaType)) {
    throw new Error(
      "Provide --mfa-type <n> (or a positional integer). Only 1 (TOTP) and 2 (Email) have an OTP provider; IAM rejects the rest."
    );
  }
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/generate", {
    body: {
      mfaType,
      sendPhoneNumberAsEmailDomain: stringFlag(flags, "send-phone-number-as-email-domain") || undefined
    },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
