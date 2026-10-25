import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamUsersActivate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userId = args[0] || stringFlag(flags, "user-id", { required: true });
  // ActivateUserByAdminRequest declares Reason `required` (deactivate takes no reason), so
  // leaving it out was always a 400 -- refused here, before anything is sent.
  const reason = stringFlag(flags, "reason").trim();
  if (!reason) {
    throw new CliActionableError(
      "Activating a user requires --reason (IAM records why the account was re-enabled).",
      "reason_required",
      `blocks iam users activate ${userId} --reason "<why>" --dry-run --json`
    );
  }
  const body = { reason, userId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/users/activate", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Activate IAM user '${userId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/users/activate", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
