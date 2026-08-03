import { booleanFlag, optionalIntegerFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      allowBackupCodes: booleanFlag(flags, "allow-backup-codes") || undefined,
      allowUserOptOut: booleanFlag(flags, "allow-user-opt-out") || undefined,
      backupCodesCount: optionalIntegerFlag(flags, "backup-codes-count"),
      enableMfa: booleanFlag(flags, "enable") || undefined,
      mfaExemptRoles: listFlag(flags, "exempt-roles"),
      mfaRequiredRoles: listFlag(flags, "required-roles"),
      requireMfaForAllUsers: booleanFlag(flags, "require-for-all-users") || undefined,
      userMfaType: listFlag(flags, "user-mfa-type")?.map(Number)
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/mfa/config", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save MFA tenant policy for the selected project.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/mfa/config", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
