---
name: blocks-iam-sso-oidc-configuration
description: "PORTAL-ONLY BY DEFAULT — this skill never calls an API or CLI command to create an identity provider on the user's behalf. Use whenever the user wants to enable/configure SSO, register an OIDC identity provider, or let end users log into their own Blocks app via hosted login — 'enable SSO for my project', 'set up an OIDC identity provider', 'configure single sign-on', 'add a login provider for my app's users'. The default and expected flow: tell the user to register the identity provider themselves at https://os.seliseblocks.com, wait for them to confirm it's done, then hand off to blocks-iam-sso-oidc-implementation for the frontend login wiring. Do NOT confuse this with `blocks-os login` (the CLI's own login, which authenticates itself with no setup and needs no registration at all — see blocks-onboarding). blocks-os has zero commands for identity-provider/OIDC-client provisioning — that's intentional, not a gap to route around with raw fetch/curl or by improvising an API call. A secondary, heavily-caveated note covers the @seliseblocks/client SDK's identityProviders admin methods, which exist only so a signed-in human admin can click a button in an in-app settings screen you build for them — never for an agent to call proactively or as automation."
---

# Blocks IAM — SSO / OIDC Configuration

**The default path for this skill has no code in it.** Setting up SSO for a Blocks project means registering an identity provider / OIDC client, and that registration is **portal-only and human-driven, by deliberate platform design** — not something this skill (or any agent) does via API, CLI, or script.

## The one thing to get right: which login is this?

Don't conflate the CLI's own login with the identity provider this skill configures.

| | `blocks-os login` | The one THIS skill covers |
|---|---|---|
| What it's for | Lets `blocks-os` itself authenticate | Lets **end users log into the user's own app** via hosted SSO |
| Client type | Packaged into the CLI - nothing to register, no secret to hold | Public (browser client, no secret) |
| Registered via | Nothing to register - just run `blocks-os login` | Portal, then wired into the app's login screen |
| Owned by | **blocks-onboarding** skill | **This skill**, handing off to **blocks-iam-sso-oidc-implementation** |

If the user is asking "how do I get `blocks-os` logged in" or hits `not_logged_in`, that's **blocks-onboarding**, not this skill. This skill is about the identity provider that sits in front of *the user's own application's* login page.

## Default flow (always start here)

1. **Confirm what the user wants**: an identity provider so their app's users can sign in via SSO/OIDC. If they instead mean the CLI's own login, redirect to **[blocks-onboarding](../blocks-onboarding/SKILL.md)**.
2. **Send them to the portal.** Tell them to register the identity provider / public OIDC client themselves at **https://os.seliseblocks.com**, inside their project. Give them the practical details they'll need on that screen:
   - **Redirect URI**: their app's callback (e.g. `https://your-app.com/login/callback` or whatever `blocks-os new web` scaffolded, typically `/login/callback`) — this must match exactly what the frontend will use later.
   - **Client type**: public (no client secret — this runs in the browser).
   - **Scopes**: typically `openid profile` (add `offline_access` only if the app needs refresh tokens client-side).
3. **Wait for confirmation.** Do not proceed, do not guess a client id, do not poll an API to check if it exists — ask the user to confirm once they've created it and to share the resulting **client id** (never the secret; a public client shouldn't have one).
4. **Hand off.** Once an identity provider/client id exists, the frontend wiring — login button, callback route, token handling, calling `client.auth.idp.initiate()` / `.callback()` from `@seliseblocks/client` — is owned by **blocks-iam-sso-oidc-implementation**. Do not duplicate that work here; route to it.

That's the entire primary path. There is no step 5 that involves this skill calling an endpoint.

## Why this is portal-only (don't try to be clever)

- `blocks-os` has **zero commands** for identity-provider, OIDC-client, or SSO provisioning. Check its command list yourself if in doubt — this is confirmed, not an oversight waiting for a CLI update.
- Creating an identity provider is a **sensitive tenant-security action**. The platform owner does not want an agent creating it autonomously, even if asked nicely, even if the user says "just do it," even if a fetch/curl call to `api.seliseblocks.com` would technically work.
- **Never** raw `fetch`/`curl` this. **Never** improvise an API call because the CLI doesn't expose one — the absence of a CLI command is the policy, not a bug.
- If the user pushes back and asks you to do it anyway: explain that identity-provider registration is portal-only by design, and point them to https://os.seliseblocks.com. Do not relent by finding a workaround.

## Secondary, optional: the SDK's `identityProviders` admin methods

`@seliseblocks/client` (see `auth-client.ts`, the `readonly identityProviders = { list, get, create, update, updateStatus, delete }` block) does expose typed methods that call `GET/POST/PUT/PATCH/DELETE /iam/v4/auth/identity-providers`. Mention this **only if it adds value** to what the user is actually asking for, and only with the distinction below made explicit.

**These exist for one legitimate purpose**: letting you build an **in-app admin settings screen** for a signed-in administrator, where *they* click a button labeled something like "Add identity provider" and *they* fill in a form, in the moment they personally intend to make that change. That is a normal app feature, same as any other admin CRUD screen.

**What is fine:**
```tsx
// A settings page for a signed-in admin user. The admin types into the form
// and clicks "Save" themselves — the SDK call fires from THEIR click handler.
async function onSaveClicked(formValues: IdentityProviderFormValues) {
  await client.auth.identityProviders.create(formValues); // admin-initiated, in the moment
}
```

**What is never acceptable** — an agent must not call `identityProviders.create` / `update` / `delete` proactively, as part of an automation, in a setup script, or "on the user's behalf" because they mentioned wanting SSO in chat:

```ts
// DO NOT DO THIS. Never write or run code like this in response to
// "set up SSO for my app" or similar chat requests. There is no signed-in
// admin clicking a button here — this is the agent auto-provisioning a
// tenant identity provider from a script, which is exactly what the
// portal-only policy above forbids.
await client.auth.identityProviders.create({
  provider: "blocks-oidc",
  clientId: generatedClientId,
  clientSecret: generatedSecret,
  issuer: "...",
  wellKnownUrl: "..."
});
```

The line is not "SDK vs. CLI vs. API" — it's **who initiates the action and when**. Building the screen: fine, any time. Using it to auto-provision instead of sending the user to the portal: never, regardless of which layer (CLI, raw HTTP, or this very SDK method) the call goes through.

## Related skills

- **[blocks-onboarding](../blocks-onboarding/SKILL.md)** — owns `blocks-os login` itself (authenticates with no setup, nothing to register or look up). Go there first if `blocks-os` itself isn't authenticated, or if the user is conflating "logging in the CLI" with "SSO for my app."
- **blocks-iam-sso-oidc-implementation** — owns everything that happens once an identity provider/client id exists: wiring the login button, callback route, and token/session handling in the scaffolded React app using `@seliseblocks/client`. This skill hands off to it and does not duplicate its content.

## Example trigger prompts → routing

- "Enable SSO for my project" / "Set up an OIDC identity provider" / "Configure single sign-on for my app" → confirm it's the app's end-user login (not the CLI's), send the user to https://os.seliseblocks.com to register it, wait for confirmation, then hand off to **blocks-iam-sso-oidc-implementation**.
- "Register an OIDC client so users can log in" → same as above — portal registration first, no API call.
- "Can you just create the identity provider via the API so I don't have to click through the portal?" → decline; explain this is portal-only by design; give them the portal link and the redirect-URI/scope details they'll need.
- "blocks-os login isn't working" / "not_logged_in" → this is the CLI's own login, not this skill — route to **blocks-onboarding**.
- "I want an admin page in my app where I can manage identity providers" → this skill's SDK section applies: help build the settings screen calling `identityProviders.list/create/update/delete` from the admin's own button clicks; do not use those calls to provision anything yourself.
