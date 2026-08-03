# Blocks OS CLI

CLI for SELISE Blocks Cloud.

- Package: `@seliseblocks/cli-os`
- Binary: `blocks-os`

## Setup

Install the npm package where you want to operate the CLI:

```bash
npm install -g @seliseblocks/cli-os
blocks-os --version
```

Then log in (device-code flow - prints a verification URL and code, opens
your browser to the verification page when possible so you only need to
click approve, then polls until approved):

```bash
blocks-os login
```

For source development in this repository:

```bash
npm install
npm run build
node bin/run.js --version
```

## Commands

| Command | Description |
|---|---|
| `blocks-os init` | Create local Blocks workspace files: `blocks.json`, data schema/rules folders, release deploy config, and `.env.example`. |
| `blocks-os doctor [--json]` | Check Node.js, OIDC config, token cache, selected project, and config file locations. Does not mutate cloud resources. |
| `blocks-os login` | Device-code login. Prints a verification URL and user code, opens the browser to the verification page when possible so you only need to click approve, then polls until the device is authorized; stores account tokens and auto-refreshes later. |
| `blocks-os auth:status [--json]` | Show only whether account/project access and refresh tokens are missing, valid, expired, or available. Does not print account config values. |
| `blocks-os auth:refresh [--project] [--json]` | Force account token refresh, or project token refresh with `--project`. |
| `blocks-os auth:remove <account>` | Clear cached tokens and stored local credentials for that account. The packaged default OS account is restored from package defaults. |
| `blocks-os logout` | Revoke the current refresh token when possible and remove local session data. |
| `blocks-os projects:list [--json]` | List accessible Blocks projects via `/os/v4/Project/Gets` using the account token. Read-only. |
| `blocks-os projects:get [tenantId] [--json]` | Read one project from `Project/Gets`. Uses selected project when `tenantId` is omitted. Read-only. |
| `blocks-os projects:create <name> [--env dev] [--yes] [--dry-run] [--json]` | Create a Blocks project/environment via `/os/v4/Project/Create` using the account token. Mutating; supports dry-run and confirmation. |
| `blocks-os use <tenantId>` | Save the selected project tenant globally and in `blocks.json` when present. Does not call cloud APIs. |
| `blocks-os iam:me [--json]` | Read the current user from IAM using the account token (CLI operator identity, not a project resource). |
| `blocks-os iam:users:*`, `iam:email:available`, `iam:roles:*`, `iam:permissions:*`, `iam:resources:*`, `iam:organizations:*`, `iam:signup-settings:*` | Full IAM admin surface for the selected project (users, roles, permissions, resource metadata, organizations and their config, signup settings). Project-scoped: requires a selected project and always uses an impersonated project token, never the account token. Mutating commands support `--dry-run`/`--yes`; rich payloads accept `--body '<json>'`/`--file <path>` on top of common convenience flags. Run `blocks-os --help` for the full command/flag list. |
| `blocks-os mfa:config:*`, `mfa:totp:*`, `mfa:generate`, `mfa:resend`, `mfa:verify`, `mfa:method:set`, `mfa:disable`, `mfa:backup-codes:*` | Project-scoped MFA admin and self-service surface (tenant MFA policy, TOTP enrollment, OTP challenge/verify, method switch, backup codes). Same project-selection and impersonation-only rules as IAM above. |
| `blocks-os auth:idp:*`, `auth:config:*`, `auth:client-credentials:*`, `auth:oidc-clients:*` | Auth admin surface: identity providers, AuthController tenant config, machine-to-machine client credentials, and OIDC client app registrations. Project-scoped, impersonated project token only. `idp:delete`, `client-credentials:save`/`delete`, and `oidc-clients:save`/`delete`/`rotate-secret` return or handle secrets shown only once - treat CLI output as sensitive and never log it. |
| `blocks-os mail:config:*`, `mail:template:*`, `mail:mailbox:*` | Project-scoped mail admin surface via `/os/v4/Mail/*`: SMTP/inbound configuration upsert/delete/duplicate, mail template CRUD/clone, and mailbox message reads. Impersonated project token only. `mail:config:save`'s `--account-password` is redacted in `--dry-run` output only. |
| `blocks-os notification:*` | Project-scoped notification channel configuration via `/os/v4/Notification/*` (list/get/save/delete). Impersonated project token only. `--channel`/`--type` are raw numeric enum values from the API. |
| `blocks-os storage:config:*` | Project-scoped storage backend configuration via `/os/v4/Storage/*` (list/get/save/delete). Impersonated project token only. `--secret-key`/`--access-key`/`--password`/`--connection-string` are redacted in `--dry-run` output only. |
| `blocks-os data:validate [--json]` | Validate local `blocks/data/schemas/*.json` and `blocks/data/rules.json` before pushing. Local-only. |
| `blocks-os data:schema:list [--json]` | List project schemas via `/data/v4/schemas` using an impersonated project token. Read-only. |
| `blocks-os data:schema:pull [--json]` | Download project schemas into `blocks/data/schemas/*.json`. Writes local files only. |
| `blocks-os data:schema:push [--dry-run] [--yes] [--json]` | Create or update project schemas via `/data/v4/schemas/define`. Mutating; uses POST for create and PUT for update. |
| `blocks-os data:rules:pull [--json]` | Download data-access policies into `blocks/data/rules.json`. Writes local files only. |
| `blocks-os data:rules:deploy [--dry-run] [--yes] [--json]` | Apply schema security and data-access policies. Mutating; supports dry-run and confirmation. |
| `blocks-os data:reload [--dry-run] [--yes] [--json]` | Reload Data schema configuration so staged schema/rule changes become live. Mutating; calls POST `/data/v4/schema-configurations/reload`. |
| `blocks-os localization:validate --module <name> --language <culture> [--file <path>] [--json]` | Validate a local i18n JSON dictionary. Supports nested JSON input and checks the flattened key/value set locally. |
| `blocks-os localization:push --module <name> --language <culture> [--file <path>] [--route <route>] [--context <text>] [--dry-run] [--yes] [--json]` | Create or update Localization keys from local i18n JSON via `/localization/v4/Key/SaveKeys`. Creates the module first through `/localization/v4/Module/Save` when missing. |
| `blocks-os localization:pull --module <name> --language <culture> [--out <path>] [--json]` | Download published cloud localization via `/localization/v4/Key/GetCloudUilmFile` and write a local JSON dictionary. |
| `blocks-os localization:assistant:translation-suggestion`, `localization:config:*`, `localization:glossary:*`, `localization:key:*`, `localization:language:*`, `localization:module:*` | Full raw `/localization/v4/*` API surface (AI translation suggestions, tenant webhook config, glossary CRUD, key CRUD/search/timeline/translate/UILM import-export/rollback, language CRUD, module CRUD/glossary tagging) alongside the file-oriented validate/push/pull commands above. Project-scoped, impersonated project token only. Run `blocks-os --help` for the full command/flag list. |
| `blocks-os release:deploy --repo-id <repoId> [--dry-run] [--yes] [--json]` | Trigger a manual Release build/deploy for a configured repository. Mutating; no artifact upload is performed by this CLI. |
| `blocks-os release:status <buildId> [--json]` | Read Release build status by build id. Read-only. |
| `blocks-os release:builds:list --repo-id <repoId> [--json]` | List Release build details for a repository. Read-only. |
| `blocks-os release:builds:get <buildId> [--json]` | Alias for `release:status`. Read-only. |
| `blocks-os new web <name> --x-blocks-key <tenantId> --app-domain <domain-or-url> [--client-id <oidcClientId>]` | Create a Vite React starter app that talks to Blocks exclusively through `@seliseblocks/client` (a single `createBlocksClient()` instance) using the SDK hosted IdP flow: `blocksClient.auth.idp.redirectToProvider()` on login click and `blocksClient.auth.idp.callback()` on `/login/callback`. Includes route guards, auto-refresh through `auth.oidc.refreshToken()`, live `auth`/`iam`/`data`/`localization` SDK examples, environment config, and safe `.gitignore` defaults. Register a **public** OIDC client with redirect URIs for both your local HTTPS dev origin and `--app-domain`, then pass its id as `--client-id` (or set `VITE_BLOCKS_OIDC_CLIENT_ID` in `.env` afterwards). |

Use `--json` on commands when AI or automation needs machine-readable output. Use `--dry-run` before mutations and `--yes` only after approval.

For agent-specific operating rules and command sequences, see [AI_USAGE_GUIDE.md](AI_USAGE_GUIDE.md).

### Scaffolded Web App Local HTTPS

For `blocks-os new web`, `--app-domain` should be the app's real Blocks domain/origin, for example `https://dbpdba.seliseblocks.com`. The generated app keeps that full value as `VITE_BLOCKS_APP_DOMAIN` and derives the local dev host without a scheme as `VITE_BLOCKS_DEV_HOST=dbpdba.seliseblocks.com`.

Browser login uses the hosted Blocks IAM IdP flow and secure cookies, so local testing on the project domain must run over HTTPS:

```bash
cd <appName>
npm install
npm run cert
npm run dev
```

Add the generated `VITE_BLOCKS_DEV_HOST` to your hosts file, for example:

```text
127.0.0.1 dbpdba.seliseblocks.com
```

Then open `https://<VITE_BLOCKS_DEV_HOST>:5173`, not plain `http://`. The generated cert script uses a Node dependency, so it works from normal PowerShell after `npm install`; OpenSSL/Git Bash is not required.

OIDC account settings are saved in the OS-specific config directory. Access and refresh tokens are stored in an OS-aware secure backend when available, and are refreshed automatically before cloud commands when a refresh token is available.

OAuth tokens use an OS-aware credential backend:

| OS | Credential backend |
|---|---|
| Windows | DPAPI-encrypted value in the CLI secret metadata file, scoped to the current Windows user. |
| macOS | Keychain generic password for the `seliseblocks-cli-os` service. |
| Linux | Secret Service through `secret-tool` when available. |
| Fallback | `0600` file storage in the CLI config directory. Set `BLOCKS_OS_SECRET_STORE=file` to force this mode for CI or minimal containers. |

Use `blocks-os doctor` or `blocks-os auth:status` to see which backend is active. Tokens are never printed by CLI status commands.

If the active OS credential backend cannot decrypt old local auth state after a Windows profile change, machine migration, Keychain reset, or corrupted token cache, clear local auth state and log in again:

```bash
blocks-os auth:remove <account>
blocks-os login
```

## Workspace

`blocks-os init` creates:

```text
blocks.json
blocks/
  data/
    schemas/
    rules.json
  localization/
  release/
    deploy.json
.env.example
```

Localization dictionaries default to `blocks/localization/<module>.<language>.json`, for example `blocks/localization/common.en.json`. AI agents can generate or update that file, run `blocks-os localization:validate`, then push it to the Localization service with `blocks-os localization:push --dry-run` followed by `--yes` after approval. Gateway v4 routes do not include an `/api` segment.

`blocks-os use <tenantId>` updates the selected project in global CLI state and `blocks.json` when present.

## Boundaries

- `iam:me` reads the CLI operator's own account identity; every other `iam:*`, `mfa:*`, `auth:idp:*`/`auth:config:*`/`auth:client-credentials:*`/`auth:oidc-clients:*`, `mail:*`, `notification:*`, and `storage:config:*` command is project-scoped and requires a selected project (`blocks-os use <tenantId>`) plus an impersonated project token - none of them ever run against the account token.
- Data covers schema/rules/reload/validate only.
- Localization covers dictionary validate/pull/push plus the full raw `/localization/v4/*` API surface (assistant, config, glossary, key, language, module).
- Release covers deploy trigger and build status/read commands only.
- No direct artifact upload unless Blocks Release adds a confirmed artifact upload API.
