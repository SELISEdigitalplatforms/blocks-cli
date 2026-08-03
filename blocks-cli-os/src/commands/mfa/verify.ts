import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaVerify(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const mfaId = args[0] || stringFlag(flags, "mfa-id", { required: true });
  const verificationCode = args[1] || stringFlag(flags, "code", { required: true });
  const authType = integerFlag(flags, "auth-type", NaN);
  if (!Number.isInteger(authType)) throw new Error("Provide --auth-type <n>.");
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/verify", {
    body: {
      authType,
      isFromTokenCall: booleanFlag(flags, "from-token-call") || undefined,
      mfaId,
      verificationCode
    },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
