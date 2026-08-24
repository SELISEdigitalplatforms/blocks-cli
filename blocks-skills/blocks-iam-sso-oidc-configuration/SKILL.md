---
name: blocks-iam-sso-oidc-configuration
description: "Enable/configure SSO for a Blocks project — register an OIDC client and identity provider so end users can log into the app via hosted login. Use for 'enable SSO', 'set up an OIDC identity provider', 'configure single sign-on', 'add a login provider'. CLI-driven by default (`blocks auth oidc-clients *` / `auth idp *`, project-scoped, --dry-run→--yes), not portal-only — the portal remains a valid alternative, especially for federated external providers (Google/Azure/Okta). Don't confuse with `blocks login` (the CLI's own login — see blocks-onboarding)."
---

# Blocks IAM — SSO / OIDC Configuration

Setting up SSO for a Blocks project means provisioning two related tenant records: an **OIDC client** (the app-facing public client used for hosted login) and an **identity provider** (the record the hosted-login redirect/callback flow actually authenticates against). Both are exposed by real, implemented `blocks` CLI commands — this is not a portal-only action.

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
     --client-type public \
     --redirect-uris "https://<app-domain>/login/callback" \
     --require-pkce --active \
     --scope "openid profile" \
     --register-as-identity-provider \
     [--dry-run] [--yes]
   ```
   This mirrors exactly what `blocks new web`'s interactive OIDC-client prompt does when scaffolding a new web app. `--register-as-identity-provider` is what turns this from "just an OIDC client" into something the hosted-login redirect flow (`auth.idp.redirectToProvider()` / `auth.idp.callback()`) can authenticate against — per the CLI's own scaffold help text, this registers the client "as a Blocks OIDC identity provider" in the same call.
3. **Verify the auto-created provider before handing off.** `--register-as-identity-provider` creates the provider record for you — but check what landed in it with `blocks auth idp list --json`, because on the common path several fields come back null. See the footguns below. If `authorizationUrl` is null, hosted login will not redirect: `GET /iam/v4/idp/initiate` (what `auth.idp.redirectToProvider()` calls) builds its target as `provider.AuthorizationUrl ?? ""` plus a query string, so the browser navigates to the app's own origin with OIDC params attached. The repair, for a provider that already exists in that state:
   ```
   blocks auth idp update <providerItemId> \
     --authorization-url "<tenant authorize endpoint>" \
     --token-url "<tenant token endpoint>" \
     --user-info-url "<tenant userinfo endpoint>" \
     [--dry-run] [--yes]
   ```
   `idp update` is the only route that persists these three — IAM's create path accepts them in its request model and drops them, and the repository's update is a plain replace with no re-discovery, so values set here stick. **Read the tenant's discovery document for the correct endpoint values rather than composing them by hand** — see the last footgun.
4. **Inspect/manage the resulting identity-provider record** with `blocks auth idp list [--json]` / `blocks auth idp get <id> [--json]`. Use `blocks auth idp status <id> --active|--active=false` to enable/disable without deleting, and `blocks auth idp delete <id>` to remove it — deleting an identity provider **also deletes its related OIDC client registration**, so treat `idp delete` as the higher-blast-radius operation of the two.
5. **`blocks auth idp create`/`update` exist as a separate, more general path** for constructing an identity-provider record directly — most relevant when federating an *external* identity provider (Google, Azure AD, Okta, etc.) rather than using Blocks' own OIDC client as the login mechanism:
   ```
   blocks auth idp create --provider <p> --provider-type <t> --protocol <proto> \
     --client-id <id> [--client-secret <secret>] [--display-name] [--issuer] \
     [--scope] [--redirect-uris a,b] [--active] \
     [--authorization-url] [--token-url] [--user-info-url] [--jwks-uri] \
     [--well-known-url] [--response-type] [--grant-types a,b] [--require-pkce] \
     [--token-endpoint-auth-method] [--initial-roles a,b] [--initial-permissions a,b] \
     [--icon] [--body '<json>'|--file <path>] [--dry-run] [--yes]
   ```
   `--provider`, `--provider-type`, `--protocol`, and `--client-id` are required on create, and are immutable afterward — `auth idp update <id>` accepts the same flags but IAM requires you to either omit them or echo the existing values exactly. Apple-specific fields (`teamId`, `keyId`, `privateKey`, `appleAudience`) go through `--body`/`--file` so no private key lands in shell history. Note that `create` stores `issuer`, `jwksUri` and `wellKnownUrl` but silently drops `authorizationUrl`, `tokenUrl` and `userInfoUrl` — pass those to `idp update` in a second call. **How exactly a `clientId` passed here pairs with an OIDC client record is not shown anywhere documented** — the two collections are related (per the cascading delete behavior above) but the create/update commands don't expose an explicit "link to this OIDC client" field beyond passing the same id. If you need to federate an external provider, treat `idp create`'s field values as IAM's contract and confirm anything beyond the flags above against the tenant's actual behavior rather than guessing.
6. **Hand off.** Once a client id (and, if relevant, an identity-provider id) exists, the frontend wiring — login button, callback route, token handling, `client.auth.idp.initiate()`/`redirectToProvider()`/`.callback()` from `@seliseblocks/client` — is owned by **blocks-iam-sso-oidc-implementation**. Do not duplicate that work here; route to it.

## Mutation discipline

Every create/update/delete/status/rotate-secret command above follows the same pattern as the rest of `blocks`:
- `--dry-run` prints the request body and target endpoint without sending it (secrets are redacted in the printed body).
- Without `--dry-run`, the command prompts "Type 'yes' to continue" before mutating anything, unless `--yes` is passed to skip the prompt.
- These are real tenant-security actions (an identity provider or public OIDC client controls who can authenticate as a given app's users) — always show the user what will happen (favor `--dry-run` first) rather than running mutations silently, and don't add `--yes` to a call the user hasn't actually approved.

Never raw `fetch`/`curl` these endpoints to route around the CLI's confirmation/dry-run discipline — use the commands above so the same guardrails apply.

## Verified footguns

- **`--client-type public` is not cosmetic — omitting it stores a browser app as confidential.** IAM derives `tokenEndpointAuthMethod` from `clientType`: `public` (or any device-flow client) becomes `"none"`, anything else becomes `"client_secret_post"`. Leave `--client-type` off and a PKCE SPA is persisted as a confidential client that is also eligible for the `client_credentials` grant. Always pass `--client-type public` for a browser client. `--require-pkce` alone does not imply it.
- **The auto-created provider's endpoint URLs come from discovery, and discovery is driven by one field.** IAM's repository-level `CreateIdentityProviderAsync` runs `PopulateProviderEndpointsFromWellKnownAsync` before inserting: if `wellKnownUrl` is set it fetches the document and fills `authorizationUrl`, `tokenUrl`, `userInfoUrl`, `jwksUri` and `issuer` from it. The only input that reaches `wellKnownUrl` on this path is `oidc-clients save --external-discovery-endpoint`. Omit it and the `else` branch runs `GetSocialMetadata(provider)`, which matches only names containing `google` or `microsoft` — for an app-named provider it returns null, so all five fields are written null **and `scope` is overwritten with `"openid profile email"`**, discarding the `offline_access` the OIDC client had just been given. Check both `authorizationUrl` and `scope` on the provider after registering.
- **This only happens at create.** Re-saving the same OIDC client does not re-run discovery: the `existingProvider` branch never touches `wellKnownUrl`, and the repository's update is a plain replace. A provider already written with null URLs cannot be repaired by re-saving the client — use `idp update`, or delete and recreate.
- **PKCE and the discovery URL exist on both records and mean different things.** `requirePkce` on the OIDC client governs the app's own authorize flow; `--require-pkce` on `auth idp` governs the *upstream* handshake `/idp/initiate` performs. `--external-discovery-endpoint` on the client is read only as the linked provider's `wellKnownUrl`; on the provider record itself use `--well-known-url`.
- **Do not compose the tenant's own discovery or authorize URL from a template.** `DiscoveryController` declares `/{tenant_id}/.well-known/openid-configuration` as an absolute route, outside the `/iam/v4` prefix that every other IAM endpoint sits behind, and every `wellKnownUrl` example in IAM's own source and tests is an *external* provider (`accounts.google.com`, `login.microsoftonline.com`, `idp.example.com`) — there is no in-repo example of a Blocks tenant pointing at itself. Whether that route resolves through the `blocksapi.<domain>` gateway as-is or needs an extra segment is **not settled in source**. Fetch the tenant's discovery document and read the endpoints out of it, or ask the user; do not assert a shape you have not seen respond.

## Secondary, optional: the SDK's `identityProviders` admin methods

`@seliseblocks/client` (see `auth-client.ts`, the `readonly identityProviders = { list, get, create, update, updateStatus, delete }` block) also exposes typed methods that call the same identity-provider resource the CLI's `auth idp` commands hit. Reach for this when you're building an **in-app admin settings screen** for a signed-in administrator, where *they* click a button labeled something like "Add identity provider" and *they* fill in a form, in the moment they personally intend to make that change:

```tsx
// A settings page for a signed-in admin user. The admin types into the form
// and clicks "Save" themselves — the SDK call fires from THEIR click handler.
async function onSaveClicked(formValues: IdentityProviderFormValues) {
  await client.auth.identityProviders.create(formValues); // admin-initiated, in the moment
}
```

Request/payload types on these SDK methods are intentionally loose (`Record<string, unknown>` passthrough) — confirm field names against the same contract the CLI's `auth idp create` flags document (`provider`, `providerType`, `protocol`, `clientId`, etc.) rather than guessing new ones.

## Related skills

- **blocks-onboarding** — owns `blocks login` itself (authenticates with no setup, nothing to register or look up). Go there first if `blocks` itself isn't authenticated, or if the user is conflating "logging in the CLI" with "SSO for my app."
- **blocks-iam-sso-oidc-implementation** — owns everything that happens once an identity provider/client id exists: wiring the login button, callback route, and token/session handling in the scaffolded React app using `@seliseblocks/client`. This skill hands off to it and does not duplicate its content.

## Example trigger prompts → routing

- "Enable SSO for my project" / "Set up an OIDC identity provider" / "Configure single sign-on for my app" → confirm it's the app's end-user login (not the CLI's), run the decision tree above (`auth oidc-clients list/get` → `auth oidc-clients save --register-as-identity-provider` if none exists), then hand off to **blocks-iam-sso-oidc-implementation**.
- "Register an OIDC client so users can log in" → `blocks auth oidc-clients list`/`get` first to avoid duplicates, then `blocks auth oidc-clients save` with `--dry-run` shown to the user before confirming.
- "Can you just create the identity provider via the API so I don't have to click through the portal?" → yes — walk them through `blocks auth oidc-clients save` / `blocks auth idp create` with `--dry-run` first, get explicit confirmation before dropping `--yes`, and mention the portal (https://os.seliseblocks.com) as an alternative if they'd rather use a GUI, especially for federated external providers where they need to register with that provider first.
- "blocks login isn't working" / "not_logged_in" → this is the CLI's own login, not this skill — route to **blocks-onboarding**.
- "I want an admin page in my app where I can manage identity providers" → this skill's SDK section applies: help build the settings screen calling `identityProviders.list/create/update/delete` from the admin's own button clicks.
