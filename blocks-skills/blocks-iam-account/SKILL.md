---
name: blocks-iam-account
description: "Signed-in (or partially-signed-in) user's own SELISE Blocks IAM account actions through @seliseblocks/client — never raw fetch/curl. Covers auth.activate (finish account setup from an emailed activation code/link), auth.resendActivation (send a new activation code), auth.validateActivation (check activation state before the final activate call), auth.changePassword (authenticated change-password), auth.recover (start forgot-password, public/no-auth), auth.resetPassword (complete forgot-password with the emailed token, public/no-auth), auth.logout and auth.logoutAll (end the current session or sign out everywhere), iam.me (fetch the current user's own IAM record — roles, permissions, active org — for app profile bootstrapping), iam.updateMe (update the CURRENT user's own profile; the backend resolves the user id from the token), and iam.users.emailAvailable/iam.users.exists (duplicate-email checks for signup/invite forms). Use whenever the user wants to: build an activation/set-password page, resend an activation email, add a forgot-password or reset-password flow, let a logged-in user change their own password, add a logout or sign-out-everywhere button, bootstrap a profile/account page after login, let a user edit their own name/profile fields, or validate an email before signup submit. This is the self-service half of IAM — the signed-in user acting on their OWN account, not admin CRUD on other users (that's blocks-iam-users / blocks-iam-access-control) and not the hosted-login redirect/callback flow itself (that's blocks-iam-sso-oidc-implementation)."
---

# Blocks IAM — Account Self-Service

Account-lifecycle and account-security actions the signed-in (or not-yet-fully-signed-in) user takes on **their own** account, all through the single `@seliseblocks/client` instance the scaffold gives you — `blocks new web` wires up `createBlocksClient({ apiUrl, xBlocksKey, oidc, accessToken })` once; every call below hangs off that instance's `.auth` or `.iam` namespace. **Never** hand-roll `fetch`/`curl` against `api.seliseblocks.com` for these.

Source of truth: `auth-client.ts` and `iam-client.ts` in `@seliseblocks/client`. Every method has a What/Why/How docstring in source — this skill surfaces them, it doesn't add new ones.

## Scope: this vs. the other IAM skills

- **This skill** — the current user acting on themselves: activate their own invite, reset their own forgotten password, change their own password, log themselves out, read/edit their own profile.
- **blocks-iam-users / blocks-iam-access-control** — an admin managing *other* users (create, deactivate, grant/revoke access). Different actor, different skill. Don't duplicate that here.
- **blocks-iam-sso-oidc-implementation** — the hosted-login redirect/callback flow (`auth.idp.initiate`/`redirectToProvider`/`callback`, `oidc.refreshToken`). This skill only covers direct account-lifecycle calls (activate, recover, reset, change-password, logout) that a user takes outside that redirect dance — don't reimplement hosted login here.

## The SDK never owns your session

Every method here just relays IAM's request/response. The SDK **does not** read or write cookies, localStorage, or any token store — your app decides where the access token, refresh token, and "am I logged in" flag live, and passes the access token in via the `accessToken` option (string or async callback) on `createBlocksClient`. After `logout`/`logoutAll`, activation, or a password reset, **you** clear/update that app-owned state; the SDK call alone doesn't do it for you.

Request/payload types for most of these methods are intentionally loose (`Record<string, unknown>` passthrough — IAM, not the SDK, defines the exact fields). `BlocksLogoutRequest` is the one exception with a typed hint (`refreshToken?: string`). Where the SDK doesn't pin the shape, confirm exact field names against your tenant's IAM contract rather than guessing — the examples below show the well-known fields, not an exhaustive schema.

## Activation — finishing account setup

Three related calls, all under `blocksClient.auth`, all public (no bearer token needed for `activate`/`validateActivation` — the emailed code is the credential):

- **`auth.validateActivation(request)`** — `POST /iam/v4/auth/validate-activation`, no auth. Check the activation code/state *before* showing the final "set your password" step, so an expired/invalid link fails fast with a clear message instead of after the user fills out the form.
- **`auth.activate(request)`** — `POST /iam/v4/auth/activate`, no auth. Completes setup for a user created/invited in an inactive state: pass the emailed `code` plus the new password (and whatever else your tenant's activation contract needs, e.g. `firstName`/`lastName`) after your UI confirms password === confirm-password client-side (don't send a confirm field — that's a UI-only check).
- **`auth.resendActivation(request)`** — `POST /iam/v4/auth/resend-activation`. Send a new code/link when the old one expired. This call attaches the bearer token if one happens to be configured, but works either way — typical callers are not-yet-active, so don't gate this behind requiring a token.

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

- **`auth.recover(request)`** — `POST /iam/v4/auth/recover`, no auth. Public entry point for "forgot password" — typically just the account's email. Triggers IAM to send a reset link/code.
- **`auth.resetPassword(request)`** — `POST /iam/v4/auth/reset-password`, no auth. Completes the recovery: pass the emailed reset token plus the new password. IAM owns token validation and password-policy enforcement — surface its response/errors directly rather than pre-validating password rules yourself.
- **`auth.changePassword(request)`** — `POST /iam/v4/auth/change-password`, requires an access token (an authenticated account-security action, not part of the recovery flow). Use this for a signed-in "change my password" settings-page action — current password + new password.

```ts
// forgot-password page
await blocksClient.auth.recover({ email });

// reset-password page (link from the recovery email)
await blocksClient.auth.resetPassword({ code, password: newPassword });

// signed-in settings page
await blocksClient.auth.changePassword({ oldPassword, newPassword });
```

## Logout — end this session or all sessions

- **`auth.logout(request = {})`** — `POST /iam/v4/auth/logout`. Ends the current session; commonly takes `{ refreshToken }` if your app manages a refresh token directly (the typed field on `BlocksLogoutRequest`). If your app relies on the hosted IdP's session cookie instead, an empty `{}` is enough — the SDK always sends the request with `credentials: "include"`.
- **`auth.logoutAll(request = {})`** — `POST /iam/v4/auth/logout-all`. "Sign out everywhere" — invalidates every session for the account, not just the current one. Good for a security settings page next to change-password.

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

- **`iam.me()`** — `GET /iam/v4/iam/me`. The current IAM user record: roles, permissions, active organization context, resolved from the access token. This is the right call to bootstrap an app's profile/account page or a permission-gated shell after login — don't reconstruct this from token claims yourself.
- **`iam.updateMe(request)`** — `POST /iam/v4/iam/me`. Updates the CURRENT authenticated user's own profile fields (name, etc., per your tenant's IAM contract). The backend resolves the user id from the token — **never** pass another user's id here; that's `iam.users.update(id, request)` in the admin skill, a different call entirely.

```ts
const me = await blocksClient.iam.me();
// me.roles / me.permissions -> gate nav items, feature flags, etc.

await blocksClient.iam.updateMe({ firstName, lastName });
```

## Signup/invite dedup checks

Useful inside a signup or invite form before submit — both still send `x-blocks-key` even though they don't require a signed-in user:

- **`iam.users.emailAvailable(query)`** — `GET /iam/v4/iam/email/available`, no auth. Returns an availability flag (`isAvailable`/`IsAvailable` — IAM's casing varies, check both) for a candidate email.
- **`iam.users.exists(email)`** — `GET /iam/v4/iam/users/exists`. Existence check by email.

```ts
const availability = await blocksClient.iam.users.emailAvailable({ email });
if (availability.isAvailable === false || availability.IsAvailable === false) {
  // show "email already in use" before the user finishes the form
}
```

## Gotchas

- **Don't invent payload fields.** Several of these methods (`activate`, `resendActivation`, `validateActivation`, `changePassword`, `recover`, `resetPassword`, `logoutAll`, `updateMe`) take an untyped `Record<string, unknown>` in the SDK — the shape is IAM's contract, not something the client library enforces. Use the well-known fields shown above; confirm anything beyond that against the tenant's actual IAM behavior instead of guessing new field names.
- **`activate`/`validateActivation`/`recover`/`resetPassword` are public (no bearer token)** — the emailed code/token *is* the credential. `changePassword` and `updateMe` require an access token to be configured on the client (via `accessToken` on `createBlocksClient`). `logout`/`logoutAll`/`resendActivation` will attach a bearer token if one is configured, but don't require it.
- **`iam.me()` is not `auth.userInfo()` or `auth.isAuthenticated()`.** `auth.userInfo()`/`isAuthenticated()` (OIDC-style claims, session-cookie aware) belong to the SSO/OIDC login-flow territory. `iam.me()` is the full IAM user record — roles, permissions, org context — and is what this skill uses for profile bootstrapping.
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
