import { booleanFlag, optionalBooleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamSignupSettingsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  // POST /signup-settings is a full replace: SaveSignUpSettingRequest declares both
  // booleans non-nullable and both lists default to empty, and the service assigns all
  // four onto the tenant configuration unconditionally. `--default-roles participant`
  // on its own therefore switched public signup off and emptied the default
  // permissions. Read the current settings first and merge the flags over them. The
  // GET spells the list fields without the `OnSignUp` suffix the POST binds, so a
  // plain spread would carry nothing for them -- hence the rename.
  const current = carryCurrent(
    await blocksRequest<unknown>("/iam/v4/iam/signup-settings", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }),
    ["isEmailPasswordSignUpEnabled", "isSSoSignUpEnabled", "defaultRolesForNewUser", "defaultPermissionsForNewUser"],
    {
      defaultPermissionsForNewUser: "defaultPermissionsForNewUserOnSignUp",
      defaultRolesForNewUser: "defaultRolesForNewUserOnSignUp"
    }
  );

  const body = {
    ...current,
    ...(await jsonBodyFlag(flags)),
    ...compact({
      defaultPermissionsForNewUserOnSignUp: listFlag(flags, "default-permissions"),
      defaultRolesForNewUserOnSignUp: listFlag(flags, "default-roles"),
      isEmailPasswordSignUpEnabled: optionalBooleanFlag(flags, "email-password-signup"),
      isSSoSignUpEnabled: optionalBooleanFlag(flags, "sso-signup")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/signup-settings", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save IAM signup settings for the selected project.");
  const result = await blocksRequest<unknown>("/iam/v4/iam/signup-settings", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
