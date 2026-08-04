---
name: blocks-iam-mfa
description: "Self-service MFA for the signed-in user's own account — TOTP enroll/verify, OTP generate/resend/verify, method switch, disable, backup codes — via `blocksClient.mfa.*` or the project-scoped `blocks mfa *` CLI, plus tenant-wide MFA policy admin (`mfa.saveConfig` / `blocks mfa config get/save`). Use for an MFA settings screen, scripted enrollment/checks, or reading/setting a tenant's MFA policy. Not for admin-forcing MFA onto another specific user."
---

# Blocks IAM — MFA (Multi-Factor Authentication)

Two different things live under "MFA," and this skill covers both without conflating them:

1. **Self-service enrollment/verification** — the signed-in user setting up, challenging, switching, or removing MFA on **their own** account. This is `blocksClient.mfa.*` (minus `saveConfig`) in an app, or `blocks mfa totp *` / `mfa generate` / `mfa resend` / `mfa verify` / `mfa method set` / `mfa disable` / `mfa backup-codes *` from a terminal.
2. **Tenant-wide MFA policy admin** — whether MFA is enabled/required for the tenant at all, which methods are allowed, backup-code settings, and which roles are required/exempt. This is `blocksClient.mfa.config()` / `mfa.saveConfig(request)`, or `blocks mfa config get` / `mfa config save`. It configures the tenant's rules, not any one user's enrollment state.

Source of truth: `blocks-client/src/mfa/mfa-client.ts` (every method has a What/Why/How docstring — this skill surfaces them, it doesn't add new ones), `blocks-client/src/mfa/types.ts`, and `blocks-cli/src/commands/mfa/**/*.ts`. All calls hang off `/iam/v4/mfa*`.

## Scope: this vs. the other IAM skills

- **This skill** — the signed-in user's own MFA enrollment/verification, and tenant-wide MFA policy configuration (`config`/`saveConfig`).
- **blocks-iam-account** — the rest of the signed-in user's own account lifecycle (activation, forgot/reset/change password, logout, profile bootstrap, signup). It links here for MFA depth; don't duplicate that material in this file.
- **blocks-iam-users** — an admin managing *other* users' IAM records (create, deactivate, grant/revoke access). Nothing in `mfa-client.ts` or the CLI's `mfa` command family lets an admin force-enroll, reset, or disable MFA on a specific *other* user's account — the closest thing is tenant-wide, role-based policy (`mfaRequiredRoles`/`mfaExemptRoles` in `saveConfig`), which applies to a role, not a targeted user id. If a caller wants to act on another named user's MFA specifically, that capability wasn't found in this source; don't invent an endpoint for it.

## SDK — `blocksClient.mfa.*`

| Method | Endpoint | What |
|---|---|---|
| `mfa.config()` | `GET /iam/v4/mfa/config` | Reads the tenant's current MFA policy. Tenant-wide, not per-user. |
| `mfa.saveConfig(request)` | `POST /iam/v4/mfa/config` | Saves the tenant's MFA policy (enable/require MFA, allowed methods, backup-code settings, required/exempt roles). Admin/tenant-settings action — IAM enforces the required role, the SDK does not gate it. |
| `mfa.totp.setup()` | `POST /iam/v4/mfa/totp/setup` | Starts authenticator-app enrollment for the signed-in user; render IAM's returned secret/QR payload in your UI. |
| `mfa.totp.verifySetup({ code })` | `POST /iam/v4/mfa/totp/verify-setup` | Confirms enrollment with the 6-digit code from the authenticator app. |
| `mfa.generate({ mfaType, sendPhoneNumberAsEmailDomain? })` | `POST /iam/v4/mfa/generate` | Sends an email/SMS OTP challenge; IAM returns an `mfaId` to pass to `resend`/`verify`. |
| `mfa.resend({ mfaId, sendPhoneNumberAsEmailDomain? })` | `POST /iam/v4/mfa/resend` | Re-sends a pending OTP (e.g. SMS delay, spam filtering). |
| `mfa.verify({ mfaId, verificationCode, authType, isFromTokenCall? })` | `POST /iam/v4/mfa/verify` | Confirms an OTP or step-up challenge; set `isFromTokenCall` when verifying as part of a login/token exchange rather than a standalone check. |
| `mfa.setMethod({ mfaType })` | `PUT /iam/v4/mfa/method` | Switches which enrolled method is active for a user with more than one enrolled. |
| `mfa.disable()` | `POST /iam/v4/mfa/disable` | Self-service opt-out for the signed-in user, where the tenant's policy allows it. |
| `mfa.backupCodes.list()` | `GET /iam/v4/mfa/backup-codes` | Lists the signed-in user's backup codes (e.g. remaining-count display). |
| `mfa.backupCodes.generate()` | `POST /iam/v4/mfa/backup-codes/generate` | Mints a fresh set of recovery codes. Treat the response as sensitive and show it to the user only once. |
| `mfa.backupCodes.use({ code, userId })` | `POST /iam/v4/mfa/backup-codes/use` | Consumes one backup code to complete login/step-up when the primary method is unavailable. `userId` is the signed-in user's own id, not a target for an admin acting on someone else. |

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

`mfaType` and `authType` are plain numbers defined by IAM's own contract — `types.ts` notes `mfaType` is "IAM-defined numeric MFA method (its enum names aren't in the swagger contract — treat as opaque)". Neither the SDK nor the CLI documents what integer means "TOTP" vs. "SMS" vs. "email" for a given tenant; confirm the value against the tenant's actual IAM config (`mfa.config()` / `blocks mfa config get`) rather than guessing one.

## CLI — `blocks mfa *`

Every `mfa` command is **project-scoped**: it requires a project already selected (`blocks use <tenantId>`) and calls IAM with an impersonated project token — never the account token. Command segments joined by a space also accept a colon form (`mfa:totp:setup`, `mfa:backup-codes:generate`, etc.) — both resolve to the same handler; the registered names in `blocks-cli/src/index.ts` are the colon form.

Tenant policy admin (reads/mutates the tenant's rules, not a user's enrollment):

| Command | What |
|---|---|
| `blocks mfa config get [--json]` | Reads the tenant's MFA policy. |
| `blocks mfa config save [--enable] [--require-for-all-users] [--allow-user-opt-out] [--allow-backup-codes] [--backup-codes-count <n>] [--user-mfa-type 0,1] [--required-roles a,b] [--exempt-roles a,b] [--body '<json>'\|--file <path>] [--dry-run] [--yes] [--json]` | Saves the tenant's MFA policy. `--body`/`--file` supplies a base JSON payload; any convenience flag also passed overwrites the matching key on top of it (source: `config-save.ts` spreads `jsonBodyFlag` first, then the convenience flags). Requires `--dry-run` (preview only) or `--yes`/an interactive `yes` before it executes. |

Self-service enrollment, challenge, and recovery for the calling (impersonated) user:

| Command | What |
|---|---|
| `blocks mfa totp setup [--json]` | Starts TOTP enrollment; prints IAM's secret/QR payload. |
| `blocks mfa totp verify-setup <code> [--json]` | Confirms TOTP enrollment with the 6-digit code. |
| `blocks mfa totp enable --mfa-type <n> [--code <c>] [--dry-run] [--yes] [--json]` | Composed enrollment — see below. |
| `blocks mfa generate --mfa-type <n> [--send-phone-number-as-email-domain <domain>] [--json]` | Sends an OTP challenge; returns an `mfaId` to pass to `resend`/`verify`. |
| `blocks mfa resend <mfaId> [--send-phone-number-as-email-domain <domain>] [--json]` | Re-sends a pending OTP. |
| `blocks mfa verify <mfaId> <code> --auth-type <n> [--from-token-call] [--json]` | Confirms an OTP/step-up challenge. |
| `blocks mfa method set --mfa-type <n> [--json]` | Switches the impersonated user's active MFA method. |
| `blocks mfa disable [--dry-run] [--yes] [--json]` | Disables MFA for the impersonated user. Mutating: needs `--dry-run` or `--yes`. |
| `blocks mfa backup-codes list [--json]` | Lists the impersonated user's backup codes. Read-only. |
| `blocks mfa backup-codes generate [--dry-run] [--yes] [--json]` | Generates a fresh set, invalidating existing ones. Mutating: needs `--dry-run` or `--yes`. |
| `blocks mfa backup-codes use <userId> <code> [--json]` | Consumes one backup code. |

```sh
blocks mfa config get --json                        # check tenant policy before prompting enrollment
blocks mfa totp setup                               # prints secret/QR
blocks mfa totp verify-setup 123456
blocks mfa method set --mfa-type 0
blocks mfa backup-codes generate --dry-run           # preview, no call
blocks mfa backup-codes generate --yes               # after explicit confirmation
```

## The composed `mfa totp enable` command

`mfa totp enable --mfa-type <n>` (`blocks-cli/src/commands/mfa/totp-enable.ts`) chains the individual TOTP steps into one enrollment sitting, with one confirmation, rather than four separate commands run at different times:

`totp setup` → prints the QR/secret → **verification code** (from `--code`, or an interactive prompt if omitted) → `totp verify-setup <code>` → `method set --mfa-type <n>` → `backup-codes generate --yes`.

Two things worth calling out precisely, both confirmed against source:

- **`--mfa-type` is required, never defaulted.** The numeric value that means "TOTP" for a given tenant isn't documented anywhere in this CLI or SDK (the same opaque-integer caveat as `mfa generate`/`method set` above) — the command throws rather than guessing one. Look it up (e.g. via `mfa config get`, or ask the user) instead of assuming a value like `0`.
- **Two separate prompts can block a non-interactive run**, not just one: `confirmMutation` asks the operator to type `yes` before it starts (skipped by `--yes`, same as `dry-run`), and then, independently, if `--code` isn't passed, `mfaTotpEnable` calls `promptText` to read the verification code from stdin (`await promptText("Enter the 6-digit code from your authenticator app: ")`). `promptText` opens a `readline` interface on `process.stdin` and awaits an answer with no timeout — in a non-interactive/agent context with no TTY to answer it, this hangs indefinitely rather than failing fast. An agent or script running this command must pass **both** `--yes` and `--code <c>` (the code sourced from wherever the authenticator output is captured) to avoid a hang.
- `--dry-run` short-circuits before either prompt and before any network call: it prints the planned step list (`mfa:totp:setup`, the scan/enter-code step, `mfa:totp:verify-setup <code>`, `mfa:method:set <n>`, `mfa:backup-codes:generate`) and exits.

Deliberately excluded from this composed command: `mfa config save`. That's the separate tenant-wide policy action covered above, not part of enrolling one user.

## Gotchas

- **`config`/`saveConfig` (SDK) and `mfa config get`/`config save` (CLI) are tenant policy, not a user's enrollment state.** Don't call these expecting to see or change one user's MFA status — that's every other method/command in this file.
- **`mfaType`/`authType` are opaque, tenant-defined integers.** Neither `mfa-client.ts`'s types nor the CLI documents what number means "TOTP," "SMS," or "email" — confirm against the tenant's own IAM config rather than guessing.
- **`mfa totp enable` can hang waiting on stdin twice over** if run non-interactively without `--yes` and `--code` — see above. Always pass both when scripting or agent-driving this command.
- **Backup codes are shown once.** Treat `backupCodes.generate()` / `mfa backup-codes generate`'s response as sensitive; there's no re-display endpoint for the raw codes, only `list()`/`backup-codes list`, which is for a remaining-count style view, not for recovering codes you didn't save.
- **No admin "force MFA on this specific user" capability was found in this source.** The nearest thing is tenant-wide, role-based policy (`mfaRequiredRoles`/`mfaExemptRoles` via `saveConfig`/`config save`), which targets a role, not a user id. If a request needs a specific other user's MFA changed, that's out of this skill's scope — don't fabricate an endpoint to satisfy it.
- **Every `mfa` CLI command is project-scoped and impersonation-only**, same rule as the rest of the project-scoped CLI surface — `blocks use <tenantId>` first, or commands fail with `project_not_selected`.
- **Mutating CLI commands (`config save`, `disable`, `backup-codes generate`, and the composed `totp enable`) require `--dry-run` or `--yes`/an interactive `yes`** before they execute — apply the same confirm-before-mutating discipline an agent uses for any other mutating Blocks CLI command: state the exact change and get explicit go-ahead first.

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
