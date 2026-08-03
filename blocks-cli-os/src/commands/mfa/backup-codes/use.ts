import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mfaBackupCodesUse(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userId = args[0] || stringFlag(flags, "user-id", { required: true });
  const code = args[1] || stringFlag(flags, "code", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/backup-codes/use", {
    body: { code, userId },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
