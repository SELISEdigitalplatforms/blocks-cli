# Flow: Scaffolding a new web app

`blocks new web` generates a Vite React starter that talks to Blocks exclusively through `@seliseblocks/client` — a single `createBlocksClient()` instance, hosted IdP login, callback route, route guards, auto-refresh, and working auth/IAM/data/localization examples.

Resolve the OIDC client id **before** running it. See the OIDC flow — an app scaffolded against a client that does not exist is an app that cannot log anyone in.

## The command

```bash
blocks new web <appName> \
  --x-blocks-key <tenantId> \
  --app-domain https://<app-domain> \
  --client-id <publicOidcClientId> \
  --yes
```

**Always pass all three contexts explicitly.** Omitting `--app-domain` or `--client-id` drops the command into an interactive pick-list. The command also checks AuthController and may enable OIDC login; after the user approves that possible tenant mutation, pass `--yes` so a non-interactive run cannot stop at confirmation. Without approval, do not scaffold.

Leave `--blocks-api-url` off unless the project uses a non-default gateway. The scaffold derives it from the app domain, and passing a wrong one by hand is harder to notice than leaving it out.

Failure or missing non-interactive approval stops before local files are scaffolded.

## Then work inside the app

```bash
cd <appName>
npm install
```

**Everything from here happens inside `<appName>`.** This matters most for `blocks init`, which creates `blocks.json` and a `blocks/` directory in whatever the current directory is. Run it in the parent workspace and those files land outside the app, where the app's own tooling will not find them.

```bash
blocks init
```

Run it only when the work actually needs project-local Blocks files — data schemas, rules, and similar. A plain frontend does not need it. It is safe to re-run: it never overwrites a file that already exists. It does not create a localization folder (that appears lazily, the first time a localization pull writes to it) and there is no release file at all.

## Run it locally

```bash
npm run cert
npm run dev
```

Blocks login will not work over plain `localhost` — the app must be served over HTTPS on the project's own domain, which needs a hosts-file entry mapping that domain to `127.0.0.1` and a locally trusted certificate. `blocks-frontend-local-https` owns that setup, including the trust step and the failure modes. The generated app's own README is the final word for its dev loop.

## Verify

Open the app on its HTTPS domain and complete a real login. If the login button leads nowhere, the problem is almost never the scaffold — check the identity provider's authorization URL and `isOidcEnabled` in the OIDC flow, and confirm a user actually exists.

## Gotchas

- **Do not run `blocks init` before scaffolding.** It is the most common way to end up with `blocks.json` in the wrong directory.
- **The redirect URI on the OIDC client must match the URL the app actually runs on**, including the port. A client registered for a production domain will not authorize a local dev session.
- **Never put a client secret in the generated app.** A browser app uses the public client id only.

## Done when

- The app runs over HTTPS on the project's domain.
- A real user completes a real login through it.
- `blocks.json` and `blocks/`, if they exist at all, are inside the app directory.
