import { BlocksHttpClient } from "../http/http-client.js";
import {
  BlocksMfaBackupCodeUseRequest,
  BlocksMfaConfig,
  BlocksMfaConfigSaveRequest,
  BlocksMfaGenerateRequest,
  BlocksMfaPassThroughResponse,
  BlocksMfaResendRequest,
  BlocksMfaSetMethodRequest,
  BlocksMfaVerifyRequest,
  BlocksMfaVerifyTotpSetupRequest
} from "./types.js";

const MFA_API = "/iam/v4/mfa";

/**
 * MFA surface: enroll, verify, switch, or disable the signed-in user's own MFA and manage
 * their own backup codes, plus `saveConfig` for the tenant-wide MFA policy. Like
 * `identityProviders`/`config`/`clientCredentials` on `BlocksAuthenticationClient`, `saveConfig`
 * is an admin/tenant-settings action -- IAM enforces the required role, the SDK does not gate it.
 */
export class BlocksMfaClient {
  constructor(private readonly http: BlocksHttpClient) {}

  /**
   * What: reads the tenant's current MFA policy through `GET /iam/v4/mfa/config`.
   * Why: consumer apps can check whether MFA is enabled/required before prompting enrollment.
   * How: call with an authorized token; the SDK returns IAM's policy shape as-is.
   */
  config(): Promise<BlocksMfaConfig> {
    return this.http.request<BlocksMfaConfig>(`${MFA_API}/config`);
  }

  /**
   * What: saves the tenant's MFA policy through `POST /iam/v4/mfa/config`.
   * Why: tenant admin/settings screens need to turn MFA on/off, require it for specific roles,
   * or configure backup codes -- this is not a user self-service action.
   * How: pass IAM's full config payload with an authorized, sufficiently-privileged token.
   */
  saveConfig(request: BlocksMfaConfigSaveRequest): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/config`, { body: request });
  }

  readonly totp = {
    /**
     * What: starts TOTP enrollment through `POST /iam/v4/mfa/totp/setup`.
     * Why: authenticator-app enrollment needs a secret/QR payload from IAM before the user can scan it.
     * How: call for the signed-in user, then render IAM's returned secret/QR data in your enrollment UI.
     */
    setup: (): Promise<BlocksMfaPassThroughResponse> =>
      this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/totp/setup`, { method: "POST" }),

    /**
     * What: confirms TOTP enrollment through `POST /iam/v4/mfa/totp/verify-setup`.
     * Why: IAM must confirm the user's authenticator app is correctly configured before enabling TOTP.
     * How: pass the 6-digit `code` the user typed from their authenticator app.
     */
    verifySetup: (request: BlocksMfaVerifyTotpSetupRequest): Promise<BlocksMfaPassThroughResponse> =>
      this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/totp/verify-setup`, { body: request })
  };

  /**
   * What: sends an OTP challenge through `POST /iam/v4/mfa/generate`.
   * Why: email/SMS-based MFA needs IAM to issue and deliver a one-time code before verification.
   * How: pass the target `mfaType`; IAM returns an `mfaId` to pass to `verify`/`resend`.
   */
  generate(request: BlocksMfaGenerateRequest): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/generate`, { body: request });
  }

  /**
   * What: resends a pending OTP through `POST /iam/v4/mfa/resend`.
   * Why: users may not receive the first code (SMS delay, spam filtering) and need a retry.
   * How: pass the `mfaId` returned from `generate`.
   */
  resend(request: BlocksMfaResendRequest): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/resend`, { body: request });
  }

  /**
   * What: verifies an OTP or step-up challenge through `POST /iam/v4/mfa/verify`.
   * Why: login and sensitive in-app actions need this to confirm the code the user entered.
   * How: pass `mfaId`, `verificationCode`, and `authType`; set `isFromTokenCall` when verifying as part of a token/login exchange rather than a standalone check.
   */
  verify(request: BlocksMfaVerifyRequest): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/verify`, { body: request });
  }

  /**
   * What: sets the signed-in user's active MFA method through `PUT /iam/v4/mfa/method`.
   * Why: users who have enrolled more than one method need to switch which one is active.
   * How: pass the `mfaType` to activate; enroll it first (e.g. via `totp.setup`/`verifySetup`) if it isn't already.
   */
  setMethod(request: BlocksMfaSetMethodRequest): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/method`, {
      body: request,
      method: "PUT"
    });
  }

  /**
   * What: disables MFA for the signed-in user through `POST /iam/v4/mfa/disable`.
   * Why: users need a self-service way to turn MFA off when the tenant's policy allows opt-out.
   * How: call with an authorized token; IAM enforces whether opt-out is permitted for this tenant/role.
   */
  disable(): Promise<BlocksMfaPassThroughResponse> {
    return this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/disable`, { method: "POST" });
  }

  readonly backupCodes = {
    /**
     * What: lists the signed-in user's backup codes through `GET /iam/v4/mfa/backup-codes`.
     * Why: account-security screens need to show how many unused recovery codes remain.
     * How: call with an authorized token.
     */
    list: (): Promise<BlocksMfaPassThroughResponse> =>
      this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/backup-codes`),

    /**
     * What: generates a fresh set of backup codes through `POST /iam/v4/mfa/backup-codes/generate`.
     * Why: users need recovery codes for when their primary MFA method is unavailable.
     * How: call once TOTP/OTP is enrolled; treat the response as sensitive and show it to the user only once.
     */
    generate: (): Promise<BlocksMfaPassThroughResponse> =>
      this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/backup-codes/generate`, { method: "POST" }),

    /**
     * What: consumes one backup code through `POST /iam/v4/mfa/backup-codes/use`.
     * Why: lets a user complete login/step-up when their primary MFA method is unavailable.
     * How: pass the signed-in `userId` and the backup `code` the user entered; each code is single-use.
     */
    use: (request: BlocksMfaBackupCodeUseRequest): Promise<BlocksMfaPassThroughResponse> =>
      this.http.request<BlocksMfaPassThroughResponse>(`${MFA_API}/backup-codes/use`, { body: request })
  };
}
