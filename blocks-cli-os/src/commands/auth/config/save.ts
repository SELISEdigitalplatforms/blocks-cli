import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      absoluteRefreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "absolute-refresh-token-minutes"),
      accessTokenValidForNumberMinutes: optionalIntegerFlag(flags, "access-token-minutes"),
      accountLockDurationInMinutes: optionalIntegerFlag(flags, "account-lock-duration-minutes"),
      getNumberOfWrongAttemptsToLockTheAccount: optionalIntegerFlag(flags, "wrong-attempts-to-lock"),
      isOidcEnabled: booleanFlag(flags, "oidc-enabled") || undefined,
      logoutOnPasswordChange: booleanFlag(flags, "logout-on-password-change") || undefined,
      passwordStrengthCheckerRegex: stringFlag(flags, "password-strength-regex") || undefined,
      refreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "refresh-token-minutes"),
      rememberMeRefreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "remember-me-refresh-token-minutes")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/config", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save AuthController configuration for the selected project.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/auth/config", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
