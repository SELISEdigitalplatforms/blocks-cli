import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mfaBackupCodesGenerate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/mfa/backup-codes/generate" }, flags);
    return;
  }

  await confirmMutation(flags, "Generate a fresh set of MFA backup codes, invalidating any existing ones.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/mfa/backup-codes/generate", {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
