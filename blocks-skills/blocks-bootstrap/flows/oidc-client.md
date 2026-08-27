# Flow: Making the app's login work

Three records must agree before any end user can sign in: a **public OIDC client**, an **identity provider** registered against it, and **`isOidcEnabled: true`** on the project's auth config. Missing any one of them produces an app with a login button that goes nowhere.

This is the app's own end-user login. It has nothing to do with `blocks login`, which is how the CLI authenticates itself and needs no setup at all. If the user is confusing the two, say so before running anything.

All of it is project-scoped: a project must be selected, or pass `--project <tenantId>`.

## 1. Reuse before creating

```bash
blocks auth oidc-clients list --json
```

If a public client already exists whose redirect URI matches the app being built, reuse its id and skip to step 3. Registering a second client for the same app is the most common mess to walk into later.

`client_secret` is never in a list or get response — it is shown once, at creation or rotation, and never again.

## 2. Create one

```bash
blocks auth oidc-clients save \
  --client-display-name "<app name>" \
  --client-type public \
  --redirect-uris "https://<app-domain>/login/callback" \
  --scope "openid profile" \
  --require-pkce \
  --register-as-identity-provider \
  --auto-redirect \
  --dry-run --json
```

Show the dry-run output, get approval, then re-run with `--yes`.

Four flags carry real weight:

- **`--client-type public`** is not optional in practice. IAM derives the token endpoint auth method from the client type, so leaving it off stores a browser app as *confidential* and lets it request the client-credentials grant. `--require-pkce` alone does not imply it.
- **`--register-as-identity-provider`** creates the linked identity provider in the same call. The CLI supplies its discovery endpoint; verify the resulting provider has authorize, token, userinfo, jwks, and issuer values because population is backend behavior. Without a usable provider, the client cannot authenticate anyone.
- **`--auto-redirect`** matters because the scaffolded login page already navigates straight to the provider. Without it the hosted login page adds a redundant manual "continue" click.
- **`--item-id`** is required when updating an existing client rather than creating one. The save endpoint replaces the whole client document; the CLI fetches the current one first and merges your change into it. Omit `--item-id` and you register a duplicate instead of editing.

If a `client_secret` comes back, treat that output as sensitive: never print it, log it, commit it, or put it in frontend code. A browser app uses only the client id.

## 3. Turn OIDC login on

```bash
blocks auth config get --json
```

If `isOidcEnabled` is `false`, no amount of correct client configuration produces a login screen:

```bash
blocks auth config save --oidc-enabled --account-action-base-url <https://iam-host> --dry-run --json
```

Then `--yes` after approval. `--account-action-base-url` is required when the current config has no value; use the actual IAM/account-action host, never invent one. `blocks new web` fills this from its resolved OIDC URL when it enables login itself.

## 4. Verify what actually landed

```bash
blocks auth idp list --json
```

Confirm the provider exists and its `authorizationUrl` is not null. A provider written with null endpoints will not redirect — the browser gets sent to the app's own origin with OIDC parameters attached instead of to a login page.

This is repairable only through `blocks auth idp update <providerItemId>`, not by re-saving the client: discovery runs only at create time, and re-saving does not re-run it. `blocks-iam-sso-oidc-configuration` has the field-level detail for that repair.

## 5. Ask how users will sign in

Now ask, once:

> Do you want social sign-in (Google, Microsoft, and so on), or username and password?

- **Username and password** — nothing further to configure. Tell them plainly: their users will sign in with email or username plus a password on the Blocks hosted login page. Then go create the first user.
- **Social** — that is a separate provider record with credentials the user must obtain from Google or Microsoft first. Go to the social identity provider flow.

Do not set up social sign-in because it seems nicer. It requires the user to register an application with that provider and hand over a client secret; it is their decision, not a default.

## Done when

- A public OIDC client exists, with the app's real redirect URI.
- An identity provider is registered against it with a non-null authorization URL.
- `blocks auth config get --json` reports `isOidcEnabled: true`.
- No secret has been printed, written to a file, or committed.
