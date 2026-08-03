import { booleanFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaDisable(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/mfa/disable" }, flags);
    return;
  }

  await confirmMutation(flags, "Disable MFA for the impersonated user's session.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/mfa/disable", {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
