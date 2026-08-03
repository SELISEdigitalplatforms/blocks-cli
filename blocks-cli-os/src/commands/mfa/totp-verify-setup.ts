import { stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaTotpVerifySetup(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const code = args[0] || stringFlag(flags, "code", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/totp/verify-setup", {
    body: { code },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
