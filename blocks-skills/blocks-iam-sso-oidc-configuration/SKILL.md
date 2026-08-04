---
name: blocks-iam-sso-oidc-configuration
description: "Enable/configure SSO for a Blocks project — register an OIDC client and identity provider so end users can log into the app via hosted login. Use for 'enable SSO', 'set up an OIDC identity provider', 'configure single sign-on', 'add a login provider'. CLI-driven by default (`blocks auth oidc-clients *` / `auth idp *`, project-scoped, --dry-run→--yes), not portal-only — the portal remains a valid alternative, especially for federated external providers (Google/Azure/Okta). Don't confuse with `blocks login` (the CLI's own login — see blocks-onboarding)."
---

# Blocks IAM — SSO / OIDC Configuration

Setting up SSO for a Blocks project means provisioning two related tenant records: an **OIDC client** (`/iam/v4/oidc-clients`, the app-facing public client used for hosted login) and an **identity provider** (`/iam/v4/auth/identity-providers`, the record the hosted-login redirect/callback flow actually authenticates against). Both are exposed by real, implemented `blocks` CLI commands — this is not a portal-only action.

## The one thing to get right: which login is this?

Don't conflate the CLI's own login with the identity provider this skill configures.

| | `blocks login` | The one THIS skill covers |
|---|---|---|
| What it's for | Lets `blocks` itself authenticate | Lets **end users log into the user's own app** via hosted SSO |
| Client type | Packaged into the CLI - nothing to register, no secret to hold | Public (browser client, no secret) |
| Registered via | Nothing to register - just run `blocks login` | `blocks auth oidc-clients save` / `blocks auth idp create`, or the portal |
| Owned by | **blocks-onboarding** skill | **This skill**, handing off to **blocks-iam-sso-oidc-implementation** |

If the user is asking "how do I get `blocks` logged in" or hits `not_logged_in`, that's **blocks-onboarding**, not this skill. This skill is about the identity provider that sits in front of *the user's own application's* login page.

## Decision tree

All of these commands are project-scoped: they need a selected project (`blocks use <tenantId>` or `--project`) and run against an impersonated project token, not the CLI's own account token.

1. **Check for an existing OIDC client.** `blocks auth oidc-clients list [--json]` / `blocks auth oidc-clients get <clientId> [--json]`. `client_secret` is excluded from list/get responses — you only ever see it once, at creation or `rotate-secret` time. If a suitable public client already exists (matching redirect URI / display name), reuse its id — you're done, skip to handoff.
2. **If none exists, create one:**
   ```
   blocks auth oidc-clients save \
     --client-display-name "<app name>" \
     --redirect-uris "https://<app-domain>/login/callback" \
     --require-pkce --active \
     --scope "openid profile" \
     --register-as-identity-provider \
     [--dry-run] [--yes]
   ```
   This mirrors exactly what `blocks new web`'s interactive OIDC-client prompt does (see `createOidcClientInteractively()` in `blocks-cli/src/commands/new/web.ts`) when scaffolding a new web app. `--register-as-identity-provider` is what turns this from "just an OIDC client" into something the hosted-login redirect flow (`auth.idp.redirectToProvider()` / `auth.idp.callback()`) can authenticate against — per the CLI's own scaffold help text, this registers the client "as a Blocks OIDC identity provider" in the same call. For the common case (your own app logging its own users in via Blocks-hosted login), this single command is usually the entire provisioning step — `blocks new web` never calls `auth idp create` separately.
3. **Inspect/manage the resulting identity-provider record** with `blocks auth idp list [--json]` / `blocks auth idp get <id> [--json]`. Use `blocks auth idp status <id> --active|--active=false` to enable/disable without deleting, and `blocks auth idp delete <id>` to remove it — deleting an identity provider **also deletes its related OIDC client registration**, so treat `idp delete` as the higher-blast-radius operation of the two.
4. **`blocks auth idp create`/`update` exist as a separate, more general path** for constructing an identity-provider record directly — most relevant when federating an *external* identity provider (Google, Azure AD, Okta, etc.) rather than using Blocks' own OIDC client as the login mechanism:
   ```
   blocks auth idp create --provider <p> --provider-type <t> --protocol <proto> \
     --client-id <id> [--client-secret <secret>] [--display-name] [--issuer] \
     [--scope] [--redirect-uris a,b] [--active] \
     [--body '<json>'|--file <path>] [--dry-run] [--yes]
   ```
   `--provider`, `--provider-type`, `--protocol`, and `--client-id` are required on create, and are immutable afterward — `auth idp update <id>` accepts the same flags but IAM requires you to either omit them or echo the existing values exactly. Richer provider configs (JWKS, private keys, initial roles, etc.) go through `--body`/`--file` rather than a dedicated flag. **How exactly a `clientId` passed here pairs with a `/iam/v4/oidc-clients` record is not shown in the CLI source** — the two collections are related (per the cascading delete behavior above) but the create/update commands don't expose an explicit "link to this OIDC client" field beyond passing the same id. If you need to federate an external provider, treat `idp create`'s field values as IAM's contract and confirm anything beyond the flags above against the tenant's actual behavior rather than guessing.
5. **Hand off.** Once a client id (and, if relevant, an identity-provider id) exists, the frontend wiring — login button, callback route, token handling, `client.auth.idp.initiate()`/`redirectToProvider()`/`.callback()` from `@seliseblocks/client` — is owned by **blocks-iam-sso-oidc-implementation**. Do not duplicate that work here; route to it.

## Mutation discipline

Every create/update/delete/status/rotate-secret command above follows the same pattern as the rest of `blocks`:
- `--dry-run` prints the request body and target endpoint without sending it (secrets are redacted in the printed body).
- Without `--dry-run`, the command prompts "Type 'yes' to continue" before mutating anything, unless `--yes` is passed to skip the prompt.
- These are real tenant-security actions (an identity provider or public OIDC client controls who can authenticate as a given app's users) — always show the user what will happen (favor `--dry-run` first) rather than running mutations silently, and don't add `--yes` to a call the user hasn't actually approved.

Never raw `fetch`/`curl` these endpoints to route around the CLI's confirmation/dry-run discipline — use the commands above so the same guardrails apply.

## Two verified footguns

- **PKCE lives on the OIDC client only — `auth idp create`/`update` has no PKCE field at all.** `requirePkce` is a real flag on `oidc-clients save` (and `blocks new web`'s scaffold sets it to `true`), but `auth idp create`'s body only reads `clientId`, `clientSecret`, `displayName`, `isActive`, `issuer`, `protocol`, `provider`, `providerType`, `redirectUris`, `scope` — there is no `--require-pkce`/`requirePkce` equivalent on the identity-provider record, and no such flag is documented in `blocks auth idp create --help`. Don't go looking for a matching PKCE setting on the identity provider, and don't assume passing one through `--body`/`--file` does anything — the command doesn't read it.
- **No `wellKnownUrl` (or equivalent discovery-URL) field is exposed by any `auth idp`/`auth oidc-clients` command in source.** `oidc-clients save` has an `--external-discovery-endpoint` flag (`externalDiscoveryEndpoint` in the request body), but its exact purpose/shape and whether it's tenant-relative or absolute is not explained anywhere in the CLI source or its help text, and `auth idp create`/`update` has no discovery/well-known field whatsoever. **Do not assert a well-known URL shape (e.g. one derived from "the project's own tenant id") as fact — this needs live verification against the tenant API**, not a guess. If a well-known/discovery URL matters for what you're building, treat `--external-discovery-endpoint` as the one lead worth testing live, and confirm the exact shape empirically before documenting it as settled.

## Secondary, optional: the SDK's `identityProviders` admin methods

`@seliseblocks/client` (see `auth-client.ts`, the `readonly identityProviders = { list, get, create, update, updateStatus, delete }` block) also exposes typed methods that call `GET/POST/PUT/PATCH/DELETE /iam/v4/auth/identity-providers` — the same endpoint the CLI's `auth idp` commands hit. Reach for this when you're building an **in-app admin settings screen** for a signed-in administrator, where *they* click a button labeled something like "Add identity provider" and *they* fill in a form, in the moment they personally intend to make that change:

```tsx
// A settings page for a signed-in admin user. The admin types into the form
// and clicks "Save" themselves — the SDK call fires from THEIR click handler.
async function onSaveClicked(formValues: IdentityProviderFormValues) {
  await client.auth.identityProviders.create(formValues); // admin-initiated, in the moment
}
```

Request/payload types on these SDK methods are intentionally loose (`Record<string, unknown>` passthrough) — confirm field names against the same contract the CLI's `auth idp create` flags document (`provider`, `providerType`, `protocol`, `clientId`, etc.) rather than guessing new ones.

## Related skills

- **[blocks-onboarding](../blocks-onboarding/SKILL.md)** — owns `blocks login` itself (authenticates with no setup, nothing to register or look up). Go there first if `blocks` itself isn't authenticated, or if the user is conflating "logging in the CLI" with "SSO for my app."
- **blocks-iam-sso-oidc-implementation** — owns everything that happens once an identity provider/client id exists: wiring the login button, callback route, and token/session handling in the scaffolded React app using `@seliseblocks/client`. This skill hands off to it and does not duplicate its content.

## Example trigger prompts → routing

- "Enable SSO for my project" / "Set up an OIDC identity provider" / "Configure single sign-on for my app" → confirm it's the app's end-user login (not the CLI's), run the decision tree above (`auth oidc-clients list/get` → `auth oidc-clients save --register-as-identity-provider` if none exists), then hand off to **blocks-iam-sso-oidc-implementation**.
- "Register an OIDC client so users can log in" → `blocks auth oidc-clients list`/`get` first to avoid duplicates, then `blocks auth oidc-clients save` with `--dry-run` shown to the user before confirming.
- "Can you just create the identity provider via the API so I don't have to click through the portal?" → yes — walk them through `blocks auth oidc-clients save` / `blocks auth idp create` with `--dry-run` first, get explicit confirmation before dropping `--yes`, and mention the portal (https://os.seliseblocks.com) as an alternative if they'd rather use a GUI, especially for federated external providers where they need to register with that provider first.
- "blocks login isn't working" / "not_logged_in" → this is the CLI's own login, not this skill — route to **blocks-onboarding**.
- "I want an admin page in my app where I can manage identity providers" → this skill's SDK section applies: help build the settings screen calling `identityProviders.list/create/update/delete` from the admin's own button clicks.
