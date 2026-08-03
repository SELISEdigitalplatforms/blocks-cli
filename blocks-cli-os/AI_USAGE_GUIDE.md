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

## IAM, MFA, and Auth Admin

`iam:me` reads the CLI operator's own account identity (bootstrapping, not a project resource):

```bash
blocks-os iam:me --json
```

Every other command below is project-scoped: it requires a project already selected (`blocks-os use <tenantId>`) and always calls IAM through an impersonated project token - never the account token, and never something you construct yourself. If no project is selected, the command fails with `project_not_selected`; run `blocks-os use <tenantId>` first (see Agent Failure Handling).

Command families (run `blocks-os --help` for the full flag reference on each):

- `iam:users:*`, `iam:email:available` - list/get/create/update/activate/deactivate, access grant/revoke, existence and email-availability checks.
- `iam:roles:*` - list/get/create/update, assign-permissions, assignable.
- `iam:permissions:*` - list/get/create/update, by-severity.
- `iam:resources:*` - resource groups and feature flags (read-only).
- `iam:organizations:*` - list/get/create/update, `my`, and organization config get/save.
- `iam:signup-settings:*` - get/save tenant signup policy.
- `mfa:config:*`, `mfa:totp:*`, `mfa:generate`/`resend`/`verify`, `mfa:method:set`, `mfa:disable`, `mfa:backup-codes:*` - tenant MFA policy plus enrollment/verification/backup-code flows.
- `auth:idp:*` - identity provider (SSO/OIDC) configuration: list/get/create/update/delete/status.
- `auth:config:*` - AuthController tenant config (token lifetimes, lockout policy, etc.).
- `auth:client-credentials:*` - machine-to-machine client credentials: list/save/delete.
- `auth:oidc-clients:*` - OIDC client app registrations: list/get/save (upsert)/delete/rotate-secret.

Rules:

- Use `--dry-run` before any mutating command in these families, the same as Data/Localization/Release, then `--yes` only after explicit approval.
- Rich payloads (identity provider config, OIDC client config, user/role/permission create-update bodies, etc.) accept `--body '<json>'` or `--file <path.json>` on top of the documented convenience flags - use whichever is easier for the exact fields you need to set.
- `auth:idp:create`/`update`, `auth:client-credentials:save`, and `auth:oidc-clients:save`/`rotate-secret` can return a `client_secret` shown only once. Never print, log, commit, or otherwise persist it outside what the user explicitly asked to store; treat that response the same as any other CLI-managed secret.
- Do not add IAM/MFA/Auth admin behavior outside these supported CLI commands unless the CLI package is explicitly extended and tested.

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

### Raw Localization API

`validate`/`push`/`pull` above cover the common i18n file workflow. Every other `/localization/v4/*` endpoint is also exposed directly, project-scoped with an impersonated project token only (never the account token). Run `blocks-os --help` for the full flag reference on each; command families:

- `localization:assistant:translation-suggestion` - AI translation suggestion for a single string (`--source-text`, `--destination-language`, optional glossary/context flags).
- `localization:config:get-webhook`/`save-webhook` - tenant webhook config for localization change notifications.
- `localization:glossary:save`/`list`/`get`/`suggested`/`delete` - glossary term CRUD and AI-suggested glossary lookup.
- `localization:key:save`/`list`/`get-by-names`/`get`/`delete`/`delete-keys` - key CRUD and search beyond the bulk `push`/`pull` flow.
- `localization:key:get-timeline`/`get-localization-timeline`/`get-timeline-by-operation-id`/`rollback` - key/tenant change history and rollback.
- `localization:key:get-uilm-file`/`generate-uilm-file`/`uilm-import`/`uilm-export`/`get-uilm-exported-files`/`get-language-file-generation-history` - UILM language-file generation and import/export jobs.
- `localization:key:translate-all`/`translate-key`/`translate-keys` - trigger AI machine translation for a module or specific keys.
- `localization:language:save`/`list`/`list-for-tenant`/`delete`/`set-default` - tenant language catalog management.
- `localization:module:save`/`list`/`list-for-tenant`/`tag-glossary` - module CRUD and glossary tagging.

Same rules as everywhere else: `--dry-run` before any mutating command, then `--yes` only after explicit approval; rich payloads accept `--body '<json>'`/`--file <path.json>` on top of the documented convenience flags. `localization:config:save-webhook`'s `--secret` is redacted in `--dry-run` output only - treat the live response as a secret.

## Mail

Project-scoped SMTP/inbound mail configuration, templates, and mailbox reads via `/os/v4/Mail/*`:

```bash
blocks-os mail:config:list --json
blocks-os mail:config:get <name> --json
blocks-os mail:config:save --name <n> --host <h> --port <p> --enable-ssl \
  --sender-name <n> --sender-address <addr> --account-password <p> --dry-run --json
blocks-os mail:config:save --configuration-id <id> ... --yes --json   # update
blocks-os mail:config:delete <configurationId> --dry-run --json
blocks-os mail:config:duplicate <configurationId> --dry-run --json

blocks-os mail:template:list --configuration-id <id> --json
blocks-os mail:template:get <itemId> --json
blocks-os mail:template:save --configuration-id <id> --name <n> --language <l> \
  --subject <s> --template-body <html> --dry-run --json
blocks-os mail:template:delete <itemId> --dry-run --json
blocks-os mail:template:clone <itemId> --name <n> --dry-run --json

blocks-os mail:mailbox:list --configuration-id <id> --json
blocks-os mail:mailbox:get <messageId> --json
```

Treat `--account-password` as a secret; the CLI redacts it in `--dry-run` output but the live response is still yours to protect.

## Notification

Project-scoped notification channel configuration via `/os/v4/Notification/*`:

```bash
blocks-os notification:list --json
blocks-os notification:get <itemId> --json
blocks-os notification:save --name <n> --channel <0|1> --type <0-3> --dry-run --json
blocks-os notification:save --name <n> --channel <0|1> --type <0-3> --update --yes --json
blocks-os notification:delete <itemId> --dry-run --json
```

`--channel` and `--type` are raw numeric enum values from the Blocks OS API (`NotifierTypes`, `NotificationReceiverTypes`) — the API does not publish names for them.

## Storage

Project-scoped storage backend configuration via `/os/v4/Storage/*`:

```bash
blocks-os storage:config:list --json
blocks-os storage:config:get <name> --json
blocks-os storage:config:save --name <n> --strategy <s> --secret-key <k> --access-key <k> --dry-run --json
blocks-os storage:config:save --item-id <id> --update ... --yes --json   # update
blocks-os storage:config:delete <name> --dry-run --json
```

`--secret-key`, `--access-key`, `--password`, and `--connection-string` are secrets; the CLI redacts them in `--dry-run` output only.

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
