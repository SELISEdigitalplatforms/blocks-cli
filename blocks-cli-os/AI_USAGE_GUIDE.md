# Blocks OS CLI Guide for AI Agents

This guide is for AI agents using the published `@seliseblocks/cli-os` npm package. The installed binary is `blocks-os`.

Use `blocks-os` as the control plane. If a capability exists in the CLI, call the CLI from the terminal instead of calling Blocks cloud APIs directly from ad hoc scripts or generated application code.

## Install

Install the package in the environment where the agent will operate:

```bash
npm install -g @seliseblocks/cli-os
```

Verify the binary:

```bash
blocks-os --version
blocks-os --help
```

For local package development only, contributors may run `node bin/run.js ...` from the source repository. AI agents consuming the npm package should use `blocks-os ...`.

## Operating Rules

- Use `blocks-os ...` for all supported Blocks OS, IAM, Data, Release, and scaffold operations.
- Prefer `--json` for automation and parsing.
- Use `--dry-run` before any mutating command.
- Do not run real mutating cloud commands unless the user explicitly approved the exact action.
- Never print, commit, scaffold, or document access tokens, refresh tokens, cookies, JWTs, or other secrets.
- Treat any secret pasted into chat or logs as exposed and rotate it before production use.
- Generated apps must not contain CLI tokens.
- If a CLI command returns an error, fix or report the CLI path. Do not bypass the CLI with a one-off API request when the command exists.

## Login

Device-code login uses the packaged OS client id. It prints a verification URL and user code, opens the browser to the verification page when possible, then polls until approved:

```bash
blocks-os login
```

Check current auth state:

```bash
blocks-os auth:status --json
```

If local auth state is stale or corrupted (Windows profile change, machine migration, Keychain reset), clear local auth state and log in again:

```bash
blocks-os auth:remove <account>
blocks-os login
```

Use `blocks-os logout` to revoke the current refresh token when possible and remove local session data. Use `blocks-os auth:refresh --json` to force account token refresh, and `blocks-os auth:refresh --project --json` after a project session already exists.

Run health checks without mutation:

```bash
blocks-os doctor --json
```

## Project Workflow

List projects:

```bash
blocks-os projects:list --json
```

Create a project only after explicit user approval:

```bash
blocks-os projects:create <projectName> --env dev --dry-run --json
blocks-os projects:create <projectName> --env dev --yes --json
```

Select a project:

```bash
blocks-os use <projectTenantId>
```

Read the selected project:

```bash
blocks-os projects:get --json
```

## Scaffold a Web App

Generate a React/Vite Blocks app:

```bash
blocks-os new web <appName> --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl>
```

If a public browser OIDC client exists for the app, include it:

```bash
blocks-os new web <appName> --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl> --client-id <publicOidcClientId>
```

Validate the scaffold:

```bash
cd <appName>
npm install
npm run build
```

Do not pass CLI auth state to the scaffolded app. Browser apps must use a public OIDC client and the SDK hosted IdP flow: `blocksClient.auth.idp.redirectToProvider()` on login click and `blocksClient.auth.idp.callback()` on `/login/callback`.

`--app-domain` is the app's real Blocks domain/origin, for example `https://dbpdba.seliseblocks.com`. The generated `.env` keeps that full value as `VITE_BLOCKS_APP_DOMAIN` and derives the local dev host without a scheme as `VITE_BLOCKS_DEV_HOST=dbpdba.seliseblocks.com`.

For local browser login on the real host domain:

1. Add `127.0.0.1 <VITE_BLOCKS_DEV_HOST>` to the hosts file.
2. Run `npm install`.
3. Run `npm run cert`.
4. Run `npm run dev`.
5. Open `https://<VITE_BLOCKS_DEV_HOST>:5173`, not plain `http://`.

The generated cert script uses the `selfsigned` Node dependency, so it works from normal PowerShell after `npm install`; do not tell Windows users to switch to Git Bash just for OpenSSL. If hosted login or secure cookies fail locally, confirm the app is opened with the HTTPS dev URL from `VITE_BLOCKS_DEV_HOST`.

## IAM

The CLI exposes only the current user:

```bash
blocks-os iam:me --json
```

Do not add IAM admin behavior outside the supported CLI commands unless the CLI package is explicitly extended and tested.

## Data

Validate local files:

```bash
blocks-os data:validate --json
```

List schemas:

```bash
blocks-os data:schema:list --json
```

Pull schemas:

```bash
blocks-os data:schema:pull --json
```

Push schemas only after dry-run and approval:

```bash
blocks-os data:schema:push --dry-run --json
blocks-os data:schema:push --yes --json
```

Pull rules:

```bash
blocks-os data:rules:pull --json
```

Deploy rules only after dry-run and approval:

```bash
blocks-os data:rules:deploy --dry-run --json
blocks-os data:rules:deploy --yes --json
```

Reload Data schema configuration only after approval:

```bash
blocks-os data:reload --dry-run --json
blocks-os data:reload --yes --json
```

## Localization

Generate or update local i18n dictionaries as JSON, then let the CLI sync them to Blocks Localization. Do not ask humans to manually copy keys into the portal.

Default file convention:

```text
blocks/localization/<module>.<language>.json
```

Example:

```json
{
  "dashboard.title": "Dashboard",
  "products.empty": "No products found"
}
```

Nested JSON is accepted on input and flattened before validation:

```json
{
  "dashboard": {
    "title": "Dashboard"
  }
}
```

Validate first:

```bash
blocks-os localization:validate --module common --language en --json
```

Push only after dry-run and approval:

```bash
blocks-os localization:push --module common --language en --dry-run --json
blocks-os localization:push --module common --language en --yes --json
```

Pull published cloud localization when local fallback files need to be refreshed:

```bash
blocks-os localization:pull --module common --language en --json
```

Use Localization gateway v4 paths without `/api`: `/localization/v4/Module/Gets`, `/localization/v4/Module/Save`, `/localization/v4/Key/SaveKeys`, and `/localization/v4/Key/GetCloudUilmFile`.

## Release

Trigger a deploy only after dry-run and approval:

```bash
blocks-os release:deploy --repo-id <repoId> --dry-run --json
blocks-os release:deploy --repo-id <repoId> --yes --json
```

Read build status:

```bash
blocks-os release:status <buildId> --json
blocks-os release:builds:get <buildId> --json
```

List builds for a repository:

```bash
blocks-os release:builds:list --repo-id <repoId> --json
```

## Agent Failure Handling

- `not_logged_in`: run `blocks-os login`.
- `refresh_token_rejected`: run `blocks-os login`.
- `refresh_network_error`: check the network and configured OIDC URL, then retry.
- `auth_repair_required`: inspect `blocks-os auth:status --json`; if local storage is unreadable or stale, run `blocks-os auth:remove <account>`, then `blocks-os auth:status --json` and `blocks-os login`.
- `project_not_selected`: run `blocks-os use <projectTenantId>`.
- `api_auth_failed`: run `blocks-os auth:status --json`, then login again.
- HTML returned from an API command means the command endpoint path is wrong and must be fixed in the CLI.

## Local Development Checks

These are for contributors maintaining the package, not for normal AI package consumers:

```bash
npm test
npm pack --dry-run
```

Live smoke checks after login:

```bash
blocks-os projects:list --json
blocks-os iam:me --json
blocks-os data:schema:list --json
```

## Security Boundary

The CLI may store secrets and tokens in the OS credential backend. Generated apps must not. The scaffolded app should receive only public runtime config such as API URL, project key, app domain, OIDC URL, and public OIDC client id.
