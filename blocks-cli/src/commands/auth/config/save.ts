import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { iamAccountActionBaseUrl, OIDC_ACTIVATION_PATH, unreachableActionPageWarning } from "../../../lib/account-action.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      absoluteRefreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "absolute-refresh-token-minutes"),
      accessTokenValidForNumberMinutes: optionalIntegerFlag(flags, "access-token-minutes"),
      accountActionBaseUrl: stringFlag(flags, "account-action-base-url") || undefined,
      accountLockDurationInMinutes: optionalIntegerFlag(flags, "account-lock-duration-minutes"),
      getNumberOfWrongAttemptsToLockTheAccount: optionalIntegerFlag(flags, "wrong-attempts-to-lock"),
      isOidcEnabled: optionalBooleanFlag(flags, "oidc-enabled"),
      logoutOnPasswordChange: optionalBooleanFlag(flags, "logout-on-password-change"),
      passwordPolicyMaxLength: optionalIntegerFlag(flags, "password-policy-max-length"),
      passwordPolicyMessage: stringFlag(flags, "password-policy-message") || undefined,
      passwordPolicyMinLength: optionalIntegerFlag(flags, "password-policy-min-length"),
      passwordPolicyRequireLowercase: optionalBooleanFlag(flags, "password-policy-require-lowercase"),
      passwordPolicyRequireNumbers: optionalBooleanFlag(flags, "password-policy-require-numbers"),
      passwordPolicyRequireSpecialChars: optionalBooleanFlag(flags, "password-policy-require-special-chars"),
      passwordPolicyRequireUppercase: optionalBooleanFlag(flags, "password-policy-require-uppercase"),
      passwordStrengthCheckerMessage: stringFlag(flags, "password-strength-message") || undefined,
      passwordStrengthCheckerRegex: stringFlag(flags, "password-strength-regex") || undefined,
      refreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "refresh-token-minutes"),
      rememberMeRefreshTokenValidForNumberMinutes: optionalIntegerFlag(flags, "remember-me-refresh-token-minutes")
    })
  };

  const projectKey = await selectedProject(flags);

  // POST /auth/config replaces the whole config document rather than merging
  // (confirmed against the portal's own save call, which always resends every
  // field it read on load) -- fetch the current config first so fields the
  // caller didn't mention here survive the round trip instead of resetting.
  const current = omitNil(await blocksRequest<Record<string, unknown>>("/iam/v4/auth/config", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  }));
  const body: Record<string, unknown> = { ...current, ...overrides };

  // Turning isOidcEnabled on isn't a single independent flag: the
  // activation-link flow keys off accountActivationPath, which has to point
  // at the OIDC variant once OIDC is on, or activation emails break. Those
  // links land on IAM's hosted page, so the base URL is the IAM host -- not
  // the project's preset app domain, which serves nothing until an app is
  // deployed (the first user's activation link 404'd). IAM pins it the same
  // way on save; an explicit --account-action-base-url is still sent as given.
  const warnings: string[] = [];
  if (body.isOidcEnabled) {
    body.accountActivationPath = OIDC_ACTIVATION_PATH;
    if (!overrides.accountActionBaseUrl) body.accountActionBaseUrl = await iamAccountActionBaseUrl(flags);
    const warning = await unreachableActionPageWarning(String(body.accountActionBaseUrl));
    if (warning) warnings.push(warning);
  }
  // stderr, so a --json document on stdout stays parseable.
  for (const warning of warnings) console.error(`Warning: ${warning}`);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/config", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save AuthController configuration for the selected project.");
  const result = await blocksRequest<unknown>("/iam/v4/auth/config", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function omitNil<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)) as T;
}
