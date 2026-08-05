---
name: blocks-iam-account
description: "Signed-in (or partially-signed-in) user's own SELISE Blocks IAM account actions via @seliseblocks/client — never raw fetch/curl. Covers activation, forgot/reset/change password, logout(-all), profile bootstrap (iam.me/updateMe), self-service MFA, signup, and login-options discovery. Use for activation/password pages, logout buttons, profile bootstrap, signup forms, or letting a user manage their own MFA. The self-service half of IAM — not admin CRUD on other users (blocks-iam-users/blocks-iam-access-control), not hosted-login redirect (blocks-iam-sso-oidc-implementation)."
---

# Blocks IAM — Account Self-Service

Account-lifecycle and account-security actions the signed-in (or not-yet-fully-signed-in) user takes on **their own** account, all through the single `@seliseblocks/client` instance the scaffold gives you — `blocks new web` wires up `createBlocksClient({ apiUrl, xBlocksKey, oidc, accessToken })` once; every call below hangs off that instance's `.auth`, `.iam`, or `.mfa` namespace. **Never** hand-roll `fetch`/`curl` against `api.seliseblocks.com` for these.

Source of truth: `auth-client.ts`, `iam-client.ts`, and `mfa-client.ts` in `@seliseblocks/client`. Every method has a What/Why/How docstring in source — this skill surfaces them, it doesn't add new ones.

## Scope: this vs. the other IAM skills

- **This skill** — the current user acting on themselves: activate their own invite, reset their own forgotten password, change their own password, log themselves out, read/edit their own profile, sign up, discover login options, enroll/manage their own MFA.
- **blocks-iam-users / blocks-iam-access-control** — an admin managing *other* users (create, deactivate, grant/revoke access). Different actor, different skill. Don't duplicate that here.
- **blocks-iam-sso-oidc-implementation** — the hosted-login redirect/callback flow (`auth.idp.initiate`/`redirectToProvider`/`callback`, `oidc.refreshToken`). This skill only covers direct account-lifecycle calls (activate, recover, reset, change-password, logout) that a user takes outside that redirect dance — don't reimplement hosted login here.
- **blocks-iam-mfa** (not yet written) — the full self-service MFA walkthrough (enrollment UX, challenge flows, backup codes). This skill only notes that `mfa.*` exists and is in scope; go there for depth.

## The SDK never owns your session

Every method here just relays IAM's request/response. The SDK **does not** read or write cookies, localStorage, or any token store — your app decides where the access token, refresh token, and "am I logged in" flag live, and passes the access token in via the `accessToken` option (string or async callback) on `createBlocksClient`. After `logout`/`logoutAll`, activation, or a password reset, **you** clear/update that app-owned state; the SDK call alone doesn't do it for you.

Request/payload types for most of these methods are intentionally loose (`Record<string, unknown>` passthrough — IAM, not the SDK, defines the exact fields). `BlocksLogoutRequest` is the one exception with a typed hint (`refreshToken?: string`). Where the SDK doesn't pin the shape, confirm exact field names against your tenant's IAM contract rather than guessing — the examples below show the well-known fields, not an exhaustive schema.

## Activation — finishing account setup

Three related calls, all under `blocksClient.auth`, all public (no bearer token needed for `activate`/`validateActivation` — the emailed code is the credential):

- **`auth.validateActivation(request)`** — no auth required. Check the activation code/state *before* showing the final "set your password" step, so an expired/invalid link fails fast with a clear message instead of after the user fills out the form.
- **`auth.activate(request)`** — no auth required. Completes setup for a user created/invited in an inactive state: pass the emailed `code` plus the new password (and whatever else your tenant's activation contract needs, e.g. `firstName`/`lastName`) after your UI confirms password === confirm-password client-side (don't send a confirm field — that's a UI-only check).
- **`auth.resendActivation(request)`** — Send a new code/link when the old one expired. This call attaches the bearer token if one happens to be configured, but works either way — typical callers are not-yet-active, so don't gate this behind requiring a token.

```ts
// after the user opens /activate?code=... and submits password + confirm
const state = await blocksClient.auth.validateActivation({ code });
if (!state.valid) {
  // show "this link expired" + a resend option
}

await blocksClient.auth.activate({
  code,
  password,
  firstName,
  lastName
});
// account is now active — route to login / hosted-login (blocks-iam-sso-oidc-implementation)
```

## Password — forgot, reset, and authenticated change

- **`auth.recover(request)`** — no auth required. Public entry point for "forgot password" — typically just the account's email. Triggers IAM to send a reset link/code.
- **`auth.resetPassword(request)`** — no auth required. Completes the recovery: pass the emailed reset token plus the new password. IAM owns token validation and password-policy enforcement — surface its response/errors directly rather than pre-validating password rules yourself.
- **`auth.changePassword(request)`** — requires an access token (an authenticated account-security action, not part of the recovery flow). Use this for a signed-in "change my password" settings-page action — current password + new password.

```ts
// forgot-password page
await blocksClient.auth.recover({ email });

// reset-password page (link from the recovery email)
await blocksClient.auth.resetPassword({ code, password: newPassword });

// signed-in settings page
await blocksClient.auth.changePassword({ oldPassword, newPassword });
```

## Logout — end this session or all sessions

- **`auth.logout(request = {})`** — Ends the current session; commonly takes `{ refreshToken }` if your app manages a refresh token directly (the typed field on `BlocksLogoutRequest`). If your app relies on the hosted IdP's session cookie instead, an empty `{}` is enough — the SDK always sends the request with `credentials: "include"`.
- **`auth.logoutAll(request = {})`** — "Sign out everywhere" — invalidates every session for the account, not just the current one. Good for a security settings page next to change-password.

```ts
async function signOut() {
  try {
    await blocksClient.auth.logout({ refreshToken });
  } finally {
    // clear app-owned session state even if the network call fails,
    // so the UI never shows a stale signed-in state
    clearLocalSession();
    navigate("/login");
  }
}
```

## Profile bootstrap and self-edit

- **`iam.me()`** — The current IAM user record: roles, permissions, active organization context, resolved from the access token. This is the right call to bootstrap an app's profile/account page or a permission-gated shell after login — don't reconstruct this from token claims yourself.
- **`iam.updateMe(request)`** — Updates the CURRENT authenticated user's own profile fields (name, etc., per your tenant's IAM contract). The backend resolves the user id from the token — **never** pass another user's id here; that's `iam.users.update(id, request)` in the admin skill, a different call entirely.

```ts
const me = await blocksClient.iam.me();
// me.data?.roles / me.data?.permissions -> gate nav items, feature flags, etc.
// (iam.me() wraps the user record in a { data } envelope, not the fields directly)

await blocksClient.iam.updateMe({ firstName, lastName });
```

## Self-service MFA

Enrolling, challenging, or turning off MFA for the **signed-in user's own** account, via `blocksClient.mfa.*` (see `mfa-client.ts`'s own docstrings — they call this out as self-service, distinct from `mfa.saveConfig`, which is a tenant/admin policy action, not covered here):

- **`mfa.totp.setup()`** — Starts authenticator-app enrollment; render IAM's returned secret/QR in your UI.
- **`mfa.totp.verifySetup({ code })`** — Confirms enrollment with the 6-digit code from the authenticator app.
- **`mfa.generate({ mfaType, sendPhoneNumberAsEmailDomain? })`** — Sends an email/SMS OTP challenge; returns an `mfaId` for `resend`/`verify`.
- **`mfa.resend({ mfaId, sendPhoneNumberAsEmailDomain? })`** — Re-sends a pending OTP.
- **`mfa.verify({ mfaId, verificationCode, authType, isFromTokenCall? })`** — Confirms an OTP or step-up challenge; set `isFromTokenCall` when verifying as part of a login/token exchange.
- **`mfa.setMethod({ mfaType })`** — Switches which enrolled method is active.
- **`mfa.disable()`** — Self-service opt-out, where the tenant's policy allows it.
- **`mfa.backupCodes.list()`** / **`.generate()`** / **`.use({ code, userId })`** — View remaining recovery codes, mint a fresh set (treat the response as sensitive, show once), or consume one when the primary method is unavailable.

```ts
await blocksClient.mfa.totp.setup();
await blocksClient.mfa.totp.verifySetup({ code });
```

The same self-service surface is also reachable from a terminal via `blocks mfa totp setup/verify-setup/enable`, `blocks mfa generate/resend/verify`, `blocks mfa method set`, `blocks mfa disable`, and `blocks mfa backup-codes list/generate/use` (project-scoped, impersonated-user token). **See also:** `blocks-iam-mfa` for the full enrollment/challenge walkthrough — this section only flags that self-service MFA exists and is in this skill's scope.

## Signup and login discovery

- **`auth.signup(request)`** — no auth required. Registers a new account; IAM owns account-creation rules — send its expected payload and render its response/errors directly rather than pre-validating fields yourself.
- **`auth.loginOptions()`** — no auth required. Discovers which login methods the tenant supports; call before rendering the login screen so you only show controls IAM actually accepts.

```ts
const options = await blocksClient.auth.loginOptions();
// options -> render enabled login methods (password, social, etc.)

await blocksClient.auth.signup({ email, password, firstName, lastName });
```

## Signup/invite dedup checks

Useful inside a signup or invite form before submit — both still send `x-blocks-key` even though they don't require a signed-in user:

- **`iam.users.emailAvailable(query)`** — no auth required. Returns an availability flag (`isAvailable`/`IsAvailable` — IAM's casing varies, check both) for a candidate email.
- **`iam.users.exists(email)`** — Existence check by email.

```ts
const availability = await blocksClient.iam.users.emailAvailable({ email });
if (availability.isAvailable === false || availability.IsAvailable === false) {
  // show "email already in use" before the user finishes the form
}
```

## Gotchas

- **Don't invent payload fields.** Several of these methods (`activate`, `resendActivation`, `validateActivation`, `changePassword`, `recover`, `resetPassword`, `logoutAll`, `updateMe`) take an untyped `Record<string, unknown>` in the SDK — the shape is IAM's contract, not something the client library enforces. Use the well-known fields shown above; confirm anything beyond that against the tenant's actual IAM behavior instead of guessing new field names.
- **`activate`/`validateActivation`/`recover`/`resetPassword` are public (no bearer token)** — the emailed code/token *is* the credential. `changePassword` and `updateMe` require an access token to be configured on the client (via `accessToken` on `createBlocksClient`). `logout`/`logoutAll`/`resendActivation` will attach a bearer token if one is configured, but don't require it.
- **`iam.me()` is not `auth.userInfo()` or `auth.isAuthenticated()`.** `auth.userInfo()`/`isAuthenticated()` (OIDC-style claims, session-cookie aware) belong to the SSO/OIDC login-flow territory. `iam.me()` is the full IAM user record — roles, permissions, org context — wrapped in a `{ data }` envelope (`BlocksMeResponse = BlocksQueryResponse<BlocksUser>`), so read `me.data?.roles` etc., not `me.roles` directly.
- **Always clear local app state after logout, even on failure.** The SDK doesn't clear anything for you; a network error from `logout`/`logoutAll` shouldn't leave the UI showing a signed-in user.
- **`updateMe` never takes a user id.** If you find yourself passing an id, you want the admin `iam.users.update(id, request)` call instead — wrong skill for that.
- **Confirm-password fields are UI-only.** IAM's `activate`/`resetPassword`/`changePassword` contracts want the new password once; matching against a second "confirm" field is validated client-side and never sent.

## Example trigger prompts

- "Activate a new account with the emailed code."
- "Build the /activate page that sets a password from an invite link."
- "The activation link expired — let the user request a new one."
- "Add a forgot-password flow to the login page."
- "Build the reset-password page for the emailed reset link."
- "Let a signed-in user change their password from account settings."
- "Add a logout button."
- "Add a 'sign out of all devices' option."
- "Fetch the current user's roles and permissions after login."
- "Let a user edit their own name on their profile page."
- "Check if an email is already taken before letting someone submit the signup form."
- "Register a new account from the signup page."
- "Show which login methods are enabled before rendering the login screen."
- "Let a signed-in user enroll in authenticator-app MFA."
- "Add a 'turn off MFA' option to account security settings."
- "Let a user view or regenerate their MFA backup codes."
