---
name: blocks-iam-mfa
description: "Self-service MFA for the signed-in user's own account — TOTP enroll/verify, OTP generate/resend/verify, method switch, disable, backup codes — via `blocksClient.mfa.*` or the project-scoped `blocks mfa *` CLI, plus tenant-wide MFA policy admin (`mfa.saveConfig` / `blocks mfa config get/save`). Use for an MFA settings screen, scripted enrollment/checks, or reading/setting a tenant's MFA policy. Not for admin-forcing MFA onto another specific user."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks IAM — MFA (Multi-Factor Authentication)

Two different things live under "MFA," and this skill covers both without conflating them:

1. **Self-service enrollment/verification** — the signed-in user setting up, challenging, switching, or removing MFA on **their own** account. This is `blocksClient.mfa.*` (minus `saveConfig`) in an app, or `blocks mfa totp *` / `mfa generate` / `mfa resend` / `mfa verify` / `mfa method set` / `mfa disable` / `mfa backup-codes *` from a terminal.
2. **Tenant-wide MFA policy admin** — whether MFA is enabled/required for the tenant at all, which methods are allowed, backup-code settings, and which roles are required/exempt. This is `blocksClient.mfa.config()` / `mfa.saveConfig(request)`, or `blocks mfa config get` / `mfa config save`. It configures the tenant's rules, not any one user's enrollment state.

Source of truth: the `@seliseblocks/client` SDK's `mfa` namespace and the `blocks mfa *` CLI command family — this skill surfaces their documented behavior, it doesn't add new capability.

For CLI work, if account or project context is unknown, use blocks-bootstrap
first. Do not infer an account or tenant inside an MFA workflow.

## Scope: this vs. the other IAM skills

- **This skill** — the signed-in user's own MFA enrollment/verification, and tenant-wide MFA policy configuration (`config`/`saveConfig`).
- **blocks-iam-account** — the rest of the signed-in user's own account lifecycle (activation, forgot/reset/change password, logout, profile bootstrap, signup). It links here for MFA depth; don't duplicate that material in this file.
- **blocks-iam-users** — an admin managing *other* users' IAM records (create, deactivate, grant/revoke access). Nothing in the SDK's `mfa` namespace or the CLI's `mfa` command family lets an admin force-enroll, reset, or disable MFA on a specific *other* user's account — the closest thing is tenant-wide, role-based policy (`mfaRequiredRoles`/`mfaExemptRoles` in `saveConfig`), which applies to a role, not a targeted user id. If a caller wants to act on another named user's MFA specifically, that capability wasn't found in this source; don't invent an endpoint for it.

## SDK — `blocksClient.mfa.*`

| Method | What |
|---|---|
| `mfa.config()` | Reads the tenant's current MFA policy. Tenant-wide, not per-user. Response keys differ from the save request's (see the enum section). |
| `mfa.saveConfig(request)` | Saves the tenant's MFA policy (enable/require MFA, allowed methods, backup-code settings, required/exempt roles, `mfaTemplate`). **Merges** — IAM applies only the fields you send and keeps the rest, so a partial save is safe. Admin action: IAM requires `blocks-iam::iam::mutate-mfa-configs`; the SDK does not gate it. |
| `mfa.totp.setup()` | Starts authenticator-app enrollment for the signed-in user; render IAM's returned secret/QR payload in your UI. |
| `mfa.totp.verifySetup({ code })` | Confirms enrollment with the 6-digit code from the authenticator app. |
| `mfa.generate({ mfaType, sendPhoneNumberAsEmailDomain? })` | Sends an email/SMS OTP challenge; IAM returns an `mfaId` to pass to `resend`/`verify`. |
| `mfa.resend({ mfaId, sendPhoneNumberAsEmailDomain? })` | Re-sends a pending OTP (e.g. SMS delay, spam filtering). |
| `mfa.verify({ mfaId, verificationCode, authType, isFromTokenCall? })` | Confirms an OTP or step-up challenge; set `isFromTokenCall` when verifying as part of a login/token exchange rather than a standalone check. |
| `mfa.setMethod({ mfaType })` | Switches the active method — but IAM only branches on `1` (TOTP) and `2` (Email). **Any other value falls through to its disable path and turns the user's MFA off.** `1` requires MFA already enrolled (`mfa_not_enrolled`); `2` requires a verified email (`email_not_verified`). |
| `mfa.disable()` | Self-service opt-out for the signed-in user, where the tenant's policy allows it. |
| `mfa.backupCodes.list()` | Returns `{ remaining: <count> }` — a count, never the codes. Nothing can re-display them. |
| `mfa.backupCodes.generate()` | Mints a fresh set, invalidating the old ones. Fails with `backup_codes_disabled` unless the tenant policy allows them, and with `mfa_not_enrolled` unless the user is already enrolled — so it runs *after* enrollment, not before. Show the response once; it is the only time the codes exist in plaintext. |
| `mfa.backupCodes.use({ code, userId })` | Consumes one backup code. This endpoint is **anonymous** — it is called mid-login, when there is no session yet, which is why it takes an explicit `userId` rather than reading one from a token. It is not an admin lever: it needs the user's own unused code. |

```ts
// enrollment
await blocksClient.mfa.totp.setup();          // render the returned secret/QR
await blocksClient.mfa.totp.verifySetup({ code });

// OTP challenge (email/SMS-based methods)
const { mfaId } = await blocksClient.mfa.generate({ mfaType });
await blocksClient.mfa.verify({ mfaId, verificationCode, authType });

// tenant policy (admin screen only)
const policy = await blocksClient.mfa.config();
await blocksClient.mfa.saveConfig({ enableMfa: true, requireMfaForAllUsers: false });
```

## The numbers: `mfaType`, `authType`, `userMfaType`, `allowedMfaMethods`

All four are the **same** IAM enum (`UserMfaType`), even though the field names differ. The SDK and CLI pass them through as raw integers:

| Value | Method | Usable? |
|---|---|---|
| `0` | None | Not a method — it means "no MFA enrolled" |
| `1` | TOTP (authenticator app) | Yes |
| `2` | Email OTP | Yes |
| `3` | Sms | Declared, **no provider implemented** — IAM rejects it |
| `4` | WhatsApp | Declared, **no provider implemented** — IAM rejects it |

So in practice there are two working methods: **1 and 2**. Passing `3`/`4` to `generate`/`verify` fails IAM's provider lookup outright.

`authType` on `verify` is not a different enum — it is the `UserMfaType` of whichever method issued the challenge (`1` if the code came from an authenticator app, `2` if it was emailed).

Read-vs-write asymmetry worth knowing before you parse anything: **`config()` returns method names, requests take numbers.** The read shape is `{ enabled, allowedMethods, requireMfaForAllUsers, mfaRequiredRoles, mfaExemptRoles, allowUserOptOut, allowBackupCodes, backupCodesCount }` — note `enabled`, not `enableMfa`, and `allowedMethods`, not `userMfaType`. The login challenge likewise reports `user_mfa` as a **string name** (`"TOTP"`), not the integer you'd send back.

## CLI — `blocks mfa *`

Every `mfa` command is **project-scoped**: it requires a project already selected (`blocks use <tenantId>`) and calls IAM with an impersonated project token — never the account token. Command segments joined by a space also accept a colon form (`mfa:totp:setup`, `mfa:backup-codes:generate`, etc.) — both resolve to the same command.

Tenant policy admin (reads/mutates the tenant's rules, not a user's enrollment):

| Command | What |
|---|---|
| `blocks mfa config get [--json]` | Reads the tenant's MFA policy. |
| `blocks mfa config save [--enable[=false]] [--require-for-all-users[=false]] [--allow-user-opt-out[=false]] [--allow-backup-codes[=false]] [--backup-codes-count <n>] [--user-mfa-type 1,2] [--required-roles a,b] [--exempt-roles a,b] [--body '<json>'\|--file <path>] [--dry-run] [--yes] [--json]` | Sends tenant MFA policy fields. Explicit `--flag=false` values are preserved; omitted flags are omitted. `--body`/`--file` supplies additional fields such as `mfaTemplate`. Whether the backend merges or replaces partial payloads is not proven in this repository, so read the current config and include every field that must be preserved. |

Self-service enrollment, challenge, and recovery for the calling (impersonated) user:

| Command | What |
|---|---|
| `blocks mfa totp setup [--json]` | Starts TOTP enrollment; prints IAM's secret/QR payload. |
| `blocks mfa totp verify-setup <code> [--json]` | Confirms TOTP enrollment with the 6-digit code. |
| `blocks mfa totp enable --mfa-type <n> [--code <c>] [--dry-run] [--yes] [--json]` | Composed enrollment — see below. |
| `blocks mfa generate --mfa-type <n> [--send-phone-number-as-email-domain <domain>] [--json]` | Starts an OTP challenge. Keep the returned `mfaId` — `resend` and `verify` both need it, and there is no way to look it up afterward. |
| `blocks mfa resend <mfaId> [--send-phone-number-as-email-domain <domain>] [--json]` | Re-sends a pending OTP. |
| `blocks mfa verify <mfaId> <code> --auth-type <n> [--from-token-call] [--json]` | Confirms an OTP/step-up challenge. |
| `blocks mfa method set --mfa-type <n> [--dry-run] [--yes] [--json]` | Switches the impersonated user's active method. Only `1`/`2` switch — the CLI warns and IAM **disables MFA** for any other value. Guarded by dry-run/confirmation and also accepts the value positionally. |
| `blocks mfa disable [--dry-run] [--yes] [--json]` | Disables MFA for the impersonated user. Mutating: needs `--dry-run` or `--yes`. |
| `blocks mfa backup-codes list [--json]` | Returns `{ remaining: <count> }`, not the codes. Read-only. |
| `blocks mfa backup-codes generate [--dry-run] [--yes] [--json]` | Generates a fresh set, invalidating existing ones. Mutating: needs `--dry-run` or `--yes`. |
| `blocks mfa backup-codes use <userId> <code> [--json]` | Consumes one backup code. Anonymous endpoint, hence the explicit `userId` (`blocks iam me` has it). |

```sh
blocks mfa config get --json                         # check tenant policy before prompting enrollment
blocks mfa totp setup                                # prints secret/QR
blocks mfa totp verify-setup 123456                  # this alone enrolls and activates TOTP
blocks mfa method set --mfa-type 1 --dry-run         # review switching to TOTP
blocks mfa method set --mfa-type 1 --yes             # only after approval
blocks mfa backup-codes generate --dry-run           # preview, no call
blocks mfa backup-codes generate --yes               # after explicit confirmation
```

`totp verify-setup` already sets `MfaEnabled`, `UserMfaType = TOTP`, and `IsMfaVerified` on the user, so the follow-up `method set --mfa-type 1` is a no-op for a first enrollment — it matters only when the user has more than one method and is choosing between them.

## Turning MFA on, end to end

Three separate things must line up. Enrolling a user changes nothing on its own, and neither does flipping the tenant switch.

**1. Tenant policy** (`mfa config save`) — IAM only requires MFA at login when `enableMfa` is true **and** `userMfaType` lists at least one allowed method. `requireMfaForAllUsers` with an empty allowed-methods list is a silent no-op: the policy evaluates to "not required" and logins sail through. This is the usual cause of "I turned MFA on and nothing happened."

```sh
blocks mfa config get --json
blocks mfa config save --enable --user-mfa-type 1,2 --allow-backup-codes --backup-codes-count 8 --dry-run
blocks mfa config save --enable --user-mfa-type 1,2 --allow-backup-codes --backup-codes-count 8 --yes
```

**2. Per-OIDC-client override** (`auth oidc-clients save --require-mfa [--allowed-mfa-methods 1,2]`) — a client can require MFA even when the tenant doesn't, and can narrow the tenant's method list. IAM intersects the two, so a client allowing a method the tenant doesn't gets nothing. Worth checking before concluding the tenant policy is wrong.

**3. Enrollment**, per user, self-service only — `totp.setup()` → `totp.verifySetup({code})`, or `setMethod({mfaType: 2})` for email OTP. Then backup codes.

MFA is then required for a login when **any** of these is true: the tenant requires it for all users, one of the user's roles is in `mfaRequiredRoles`, the OIDC client requires it, or the user simply enrolled voluntarily. A role in `mfaExemptRoles` beats all of them.

### What the user sees at login

The login/token call answers with HTTP 200 and an `error` field — not a token:

| Response | Meaning | What the app does |
|---|---|---|
| `error: "mfa_enabled"`, plus `mfa_id`, `user_mfa` (method *name*), `mfa_methods` | Challenge issued; IAM already sent the OTP for email, or expects the app's TOTP code | Collect the code, re-post the same login/token request with `mfa_id`, `mfa_code`, `mfa_type` |
| `error: "mfa_enrollment_required"` (HTTP 403), plus `mfa_methods` | Policy requires MFA but this user has enrolled nothing usable | Send them into the enrollment flow, then retry login |

The `mfa_id` challenge is cached server-side with a TTL, so it expires (`invalid_mfa_session`). Wrong codes count toward the account's failed-attempt lockout: enough of them return HTTP 423 `account_locked` for the configured duration.

You do not need `mfa.generate()` for this path — IAM issues the challenge as part of the login response. `generate`/`resend`/`verify` are for in-app step-up challenges you raise yourself; `verify` with `isFromTokenCall: false` also (re)marks the user as enrolled in whatever method verified.

### When a user loses their device

There is no admin recovery. Backup codes (`backupCodes.use`, anonymous, needs `userId` + an unused code) are the only self-service path, and they only exist if the tenant allowed them *and* the user generated and saved them. IAM's own service layer has an admin-reset path with an actor and reason, audited as `mfa_reset` — but **no API route passes those fields**, so it is unreachable from the SDK, the CLI, and any app. Say that plainly rather than promising a portal reset that may not exist.

## The composed `mfa totp enable` command

`mfa totp enable --mfa-type <n>` chains the individual TOTP steps into one enrollment sitting, with one confirmation, rather than four separate commands run at different times:

`totp setup` → prints the QR/secret → **verification code** (from `--code`, or an interactive prompt if omitted) → `totp verify-setup <code>` → `method set --mfa-type <n>` → `backup-codes generate --yes`.

Two things worth calling out precisely, both confirmed against source:

- **`--mfa-type` is required, never defaulted.** For this command it is `1` (TOTP) — the value the final `method set` step activates. The command throws rather than assuming it, so pass `--mfa-type 1` explicitly.
- **The last step fails on a tenant that hasn't allowed backup codes.** `backup-codes generate` returns `backup_codes_disabled` unless `allowBackupCodes` is set in the tenant policy — enrollment itself already succeeded at that point, so treat it as "enrolled, no recovery codes" and fix the policy, not as a failed enrollment.
- **Two separate inputs are required for a non-interactive run**, not just one: `--yes` approves the enrollment mutation and `--code <c>` supplies the authenticator verification code. Without `--code`, a non-interactive run fails with `interactive_input_required`; it never waits indefinitely on stdin.
- `--dry-run` short-circuits before either prompt and before any network call: it prints the planned step list (`mfa:totp:setup`, the scan/enter-code step, `mfa:totp:verify-setup <code>`, `mfa:method:set <n>`, `mfa:backup-codes:generate`) and exits.

Deliberately excluded from this composed command: `mfa config save`. That's the separate tenant-wide policy action covered above, not part of enrolling one user.

## Gotchas

- **`config`/`saveConfig` (SDK) and `mfa config get`/`config save` (CLI) are tenant policy, not a user's enrollment state.** Don't call these expecting to see or change one user's MFA status — that's every other method/command in this file. Reading policy needs `blocks-iam::iam::mfa-configs` and writing it `blocks-iam::iam::mutate-mfa-configs`, so an ordinary end user cannot fetch it from an app.
- **`1` is TOTP and `2` is Email; `0` is None, and `3`/`4` have no provider.** Same enum for `mfaType`, `authType`, `userMfaType`, and a client's `allowedMfaMethods` — see the table above. `mfa method set` with anything but `1`/`2` disables the user's MFA.
- **`mfa totp enable` needs both `--yes` and `--code` in non-interactive use** — see above. Missing approval or input fails clearly instead of waiting on stdin.
- **Backup codes are shown once**, and only exist if the tenant set `allowBackupCodes` and the user is already enrolled — otherwise generate fails with `backup_codes_disabled` / `mfa_not_enrolled`. `list()` returns a remaining count, never the codes.
- **No admin can enroll, reset, or disable another user's MFA.** Every self-service route resolves the user from the caller's own token; the one admin-reset code path IAM has is not wired to any route. The nearest lever is role-based policy (`mfaRequiredRoles`/`mfaExemptRoles`), which targets a role, not a user id — don't fabricate an endpoint to satisfy the request.
- **Every `mfa` CLI command is project-scoped and impersonation-only**, same rule as the rest of the project-scoped CLI surface — `blocks use <tenantId>` first, or commands fail with `project_not_selected`.
- **The CLI's self-service commands act on the CLI operator's own identity** inside the selected tenant, resolved from the impersonated token. `blocks mfa totp enable` enrolls *you*, not a customer. There is no CLI path to enroll someone else — that has to happen in the app, as that user.
- **`mfa generate` on a tenant with MFA off** returns `{"errors":{"mfa_not_enable":"Please enable mfa for your application first"}}` — check `mfa config get` before assuming the method value was wrong.
- **Guarded mutating CLI commands (`config save`, `method set`, `disable`, `backup-codes generate`, and composed `totp enable`) require `--dry-run` or `--yes`/interactive confirmation.** OTP generation, resend, verification, setup, and backup-code consumption are live self-service protocol steps rather than previewable configuration mutations; invoke them only as part of the user's explicit authentication flow.

## Example trigger prompts

- "Let a signed-in user enroll in authenticator-app (TOTP) MFA."
- "Build the MFA settings screen: enroll, switch method, disable, view backup codes."
- "Check whether this tenant requires MFA before showing the enrollment prompt."
- "Turn on MFA for the whole tenant and require it for the admin role."
- "Send an OTP code to the user and verify what they typed."
- "Let a user regenerate their MFA backup codes."
- "From the terminal, enroll the current project's impersonated user in TOTP MFA end to end."
- "Run TOTP enrollment non-interactively from a script" → pass both `--yes` and `--code <c>` to `blocks mfa totp enable`, never run it unattended without them.
- "Read the tenant's current MFA policy from the CLI."
