import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamSignupSettingsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      defaultPermissionsForNewUserOnSignUp: listFlag(flags, "default-permissions"),
      defaultRolesForNewUserOnSignUp: listFlag(flags, "default-roles"),
      isEmailPasswordSignUpEnabled: booleanFlag(flags, "email-password-signup") || undefined,
      isSSoSignUpEnabled: booleanFlag(flags, "sso-signup") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/signup-settings", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save IAM signup settings for the selected project.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/signup-settings", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
