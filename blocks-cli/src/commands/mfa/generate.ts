import { integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaGenerate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const mfaType = integerFlag(flags, "mfa-type", NaN) || Number(args[0]);
  if (!Number.isInteger(mfaType)) throw new Error("Provide --mfa-type <n> (or a positional integer).");
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
