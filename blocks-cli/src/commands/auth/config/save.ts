import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
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
      isOidcEnabled: booleanFlag(flags, "oidc-enabled") || undefined,
      logoutOnPasswordChange: booleanFlag(flags, "logout-on-password-change") || undefined,
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
  const current = await blocksRequest<Record<string, unknown>>("/iam/v4/auth/config", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  const body: Record<string, unknown> = { ...current, ...overrides };

  // Turning isOidcEnabled on isn't a single independent flag: the
  // activation-link flow keys off accountActivationPath, which has to point
  // at the OIDC variant once OIDC is on, or activation emails break.
  // accountActionBaseUrl has no safe default this command can guess across
  // environments, so the caller must supply it explicitly when the tenant
  // doesn't already have one.
  const missingActionBaseUrl = Boolean(body.isOidcEnabled) && !body.accountActionBaseUrl;
  if (body.isOidcEnabled) body.accountActivationPath = "oidc/activate/";

  if (booleanFlag(flags, "dry-run")) {
    if (missingActionBaseUrl) {
      console.warn("Warning: this tenant has no accountActionBaseUrl set. Enabling OIDC login requires one -- pass --account-action-base-url <https://your-iam-host> before re-running with --yes.");
    }
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/config", request: body }, flags);
    return;
  }

  if (missingActionBaseUrl) {
    throw new Error("Enabling OIDC login requires accountActionBaseUrl, and this tenant doesn't have one set. Pass --account-action-base-url <https://your-iam-host>.");
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
