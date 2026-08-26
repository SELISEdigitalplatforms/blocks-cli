# Flow: Adding social sign-in (Google, Microsoft, and others)

Only run this when the user has explicitly asked for social sign-in. It requires them to register an application with that provider and hand over a client secret — never set it up on your own initiative, and never as a "nice default".

Prerequisite: the app's own OIDC client and `isOidcEnabled` are already sorted. Social sign-in is an addition to that, not a replacement for it.

## 1. Collect what only the user can get

A social provider cannot be configured from Blocks alone. Before running anything, the user must register an application in that provider's own console (Google Cloud Console, Microsoft Entra/Azure portal, and so on) and come back with:

- **Client id** and **client secret** issued by that provider.
- **The redirect URI they registered there**, which must match exactly what you pass to `--redirect-uris`. A mismatch here is the single most common cause of a social login that fails only at the callback.
- For Apple only: team id, key id, and the private key.

Ask for these as a set. Starting the command with only part of the required provider registration and improvising the rest wastes an approval round.

## 2. Know the four immutable fields

`--provider`, `--provider-type`, `--protocol`, and `--client-id` are required at create and **immutable afterwards** — an update must either omit them or echo the existing values exactly. Getting them wrong means deleting and recreating, so confirm before running.

- **`--provider-type social`** for every provider in this flow.
- **`--provider`** is the provider's own name, lowercase. IAM recognises: `google`, `microsoft`, `facebook`, `linkedin`, `apple`, `github`, `x`, `azuread`, `okta`, `keycloak`, `ping`, `adfs`, `windowslive`, `auth0`, `byosso`.
- **`--protocol`** must be one of `oidc`, `oauth2`, `saml`, or `ldap`. Use `oidc` for Google and Microsoft unless the user's own registration says otherwise.

Blocks' own hosted login is a different record entirely — provider `blocks-iam`, a `blocks`/`blocks-oidc` provider type. Do not edit or delete that one while adding a social provider.

## 3. Create it

```bash
blocks auth idp create \
  --provider google \
  --provider-type social \
  --protocol oidc \
  --client-id "<from the provider's console>" \
  --client-secret "<from the provider's console>" \
  --display-name "Sign in with Google" \
  --redirect-uris "<exactly what was registered there>" \
  --scope "openid profile email" \
  --well-known-url "<the provider's discovery document URL>" \
  --active \
  --dry-run --json
```

`--dry-run` redacts the client secret in its printed body, which is what makes it safe to show the user. Show it, get approval, then re-run with `--yes`.

To land self-registered users with sensible access from the start, add `--initial-roles` and `--initial-permissions`. Decide those with the user rather than picking defaults.

For Apple, put `teamId`, `keyId`, `privateKey`, and `appleAudience` in `--body` or `--file` so no private key lands in shell history.

## 4. Set the endpoints that create silently drops

IAM's create path stores `issuer`, `jwksUri`, and `wellKnownUrl` but **discards `authorizationUrl`, `tokenUrl`, and `userInfoUrl`**. Passing them to `create` looks like it worked and does not. Set them in a second call:

```bash
blocks auth idp update <providerItemId> \
  --authorization-url "<from the provider's discovery document>" \
  --token-url "<...>" \
  --user-info-url "<...>" \
  --dry-run --json
```

Read those three values out of the provider's actual discovery document rather than composing them from a template.

## 5. Verify

```bash
blocks auth idp list --json
```

Check the new provider is present, `isActive`, and has a non-null authorization URL. Then have the user try the login end to end — a social provider that lists correctly can still fail at the callback on a redirect-URI mismatch, and only a real attempt proves it.

Use `blocks auth idp status <id> --active=false` to disable a provider without removing it.

## Gotchas

- **`blocks auth idp delete` also deletes the linked OIDC client registration.** It has a wider blast radius than it looks — never use it to "clean up" a provider that is merely misconfigured. Update it, or disable it with `idp status`.
- **Never print, log, or commit the client secret.** It appears in your terminal only as the user's own input; it must not appear in your summaries, in a file, or in frontend code.
- **`--require-pkce` here governs the upstream handshake with the social provider**, which is a different thing from the same-named setting on the app's own OIDC client. Do not copy one from the other.

## Done when

- The provider is listed, active, with non-null authorization URL.
- The user has completed one real social login against the running app.
- No secret has been written anywhere outside the provider's own console.
