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
| `blocks-os iam:me [--json]` | Read the current user from IAM using the account token. This is the only IAM admin surface exposed in the MVP. |
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

- IAM is limited to `iam:me` for now.
- Data covers schema/rules/reload/validate only.
- Localization covers dictionary validate/pull/push through the Localization service.
- Release covers deploy trigger and build status/read commands only.
- No direct artifact upload unless Blocks Release adds a confirmed artifact upload API.
