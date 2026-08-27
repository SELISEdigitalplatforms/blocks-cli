# Blocks CLI

CLI for SELISE Blocks Cloud.

- Package: [`@seliseblocks/cli-os`](https://www.npmjs.com/package/@seliseblocks/cli-os)
- Binary: `blocks`

## Setup

Install the npm package where you want to operate the CLI:

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

Then log in (device-code flow - prints a verification URL and code, opens
your browser to the verification page when possible so you only need to
click approve, then polls until approved):

```bash
blocks login --account <name>
```

`--account` selects exactly that named profile. Login creates missing profile
metadata from the packaged defaults, but never copies credentials from another
account or config store.

## Account, project, and session context

State lives in `BLOCKS_CONFIG_DIR` when that variable is non-empty, otherwise in the
normal per-user OS config directory. Config, OAuth tokens, client secrets, active
account, and selected project all stay in that resolved store, so a distinct
`BLOCKS_CONFIG_DIR` fully isolates one session from another on a shared machine.

Account resolution is `--account`, then `activeAccount`. Project resolution is
`--project`, then `blocks.json`'s `project.tenantId`, then the account's
`selectedProject`. A `--project` override applies to that command only and never
changes the saved selection. Non-interactive commands fail rather than prompt.

An account holds exactly one refreshable mode at a time: either the account token
pair, or one project's impersonated pair. `blocks use <tenantId>` exchanges account
mode for project mode; `blocks deselect` exchanges it back. This is why `auth status`
reports the account tokens as `missing` once a project is selected -- expected, not a
fault. See [AGENT_GUIDE.md](./AGENT_GUIDE.md) for the full state machine.


For source development in this repository:

```bash
npm install
npm run build
node bin/run.js --version
```

## Commands

Namespaced commands accept either spaces or colons, e.g. `blocks data schema list` and
`blocks data:schema:list` are equivalent.

Global options available on every command:

| Option | Description |
|---|---|
| `--version` | Print CLI version. |
| `--json` | Print machine-readable JSON where supported. |
| `--api-url <url>` | Override the Blocks API URL for this command. |
| `--account <name>` | Use exactly this account from the resolved config store. |
| `--project <tenantId>` | Override the project for this command without changing the saved selection. |
| `--dry-run` | Show planned mutation without calling the API. |
| `--yes` | Skip mutation confirmation after explicit approval. |

The full command reference is generated from the CLI's own source, so it
cannot drift from behavior — read it from the CLI instead of a static table:

```bash
blocks --help --json           # every command name, grouped by family
blocks help <family> [--json]  # one family, with summaries (e.g. 'blocks help data')
blocks help <command> [--json] # one command: usage, flags, scope, mutation
blocks <command> --help        # same as 'blocks help <command>'
```

### Unknown flags

Flags are matched by name, so a misspelled one used to be dropped in silence —
`--hostt` for `--host` produced a clean-looking dry-run with the field simply
missing. The CLI now names any flag the command will not read:

```text
Warning: --hostt is not a flag 'blocks mail config save' reads, so its value is
ignored. Run 'blocks help mail config save' for the flags it accepts.
```

The warning goes to stderr, so `--json` output stays parseable. Set
`BLOCKS_STRICT_FLAGS=1` to turn it into a hard failure instead — worth doing in
CI and in scripted agent runs, where nothing is watching stderr.

Use `--json` on commands when AI or automation needs machine-readable output. Use `--dry-run` before mutations and `--yes` only after approval.

For agent-specific operating rules and command sequences, see [AGENT_GUIDE.md](AGENT_GUIDE.md).

### Scaffolded Web App Local HTTPS

For `blocks new web`, `--app-domain` should be the app's real Blocks domain/origin, for example `https://dbpdba.seliseblocks.com`. The generated app keeps that full value as `VITE_BLOCKS_APP_DOMAIN` and derives the local dev host without a scheme as `VITE_BLOCKS_DEV_HOST=dbpdba.seliseblocks.com`.

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
| macOS | Keychain generic password for the `seliseblocks-cli` service. |
| Linux | Secret Service through `secret-tool` when available. |
| Fallback | `0600` file storage in the CLI config directory. Set `BLOCKS_SECRET_STORE=file` to force this mode for CI or minimal containers. |

Use `blocks doctor` or `blocks auth status` to see which backend is active. Tokens are never printed by CLI status commands.

If the active OS credential backend cannot decrypt old local auth state after a Windows profile change, machine migration, Keychain reset, or corrupted token cache, clear local auth state and log in again:

```bash
blocks auth remove <account>
blocks login --account <account>
```

## Workspace

`blocks init` creates:

```text
blocks.json
blocks/
  data/
    schemas/
    rules.json
.env.example
```

Localization dictionaries are not created by `init` - the default path is `blocks/localization/<module>.<language>.json`, for example `blocks/localization/common.en.json`, and the `blocks/localization/` folder is created lazily the first time `blocks localization pull` writes to it. AI agents can create or update that file directly (before `push`, which only reads it), run `blocks localization validate`, then push it to the Localization service with `blocks localization push --dry-run` followed by `--yes` after approval. Gateway v4 routes do not include an `/api` segment.

After login selects `activeAccount`, `blocks use <tenantId>` updates that account's selected project and `blocks.json` when present. `blocks deselect` clears the same active account's selection. Different accounts in the same config store retain independent selections when each becomes active through login.

`blocks release deploy` has no local config file - it needs a repo already linked to the project. Linking a repo requires GitHub OAuth, which only the Blocks portal can do; if none is linked, the command tells you so and stops.

## Boundaries

- `iam me` reads the CLI operator's own identity, preferring project auth when a project is resolved and using account auth only in account-only mode. Every other `iam *`, `mfa *`, `auth idp *`/`auth config *`/`auth client-credentials *`/`auth oidc-clients *`, `mail *`, `notification *`, `notifier *`, and `storage config *` command is project-scoped and requires a selected project (`blocks use <tenantId>`) plus an impersonated project token.
- Data covers tenant data-source configuration, schema/rules/reload/validate, field-level validation rules, and the storage object tree (`data files *`). Prefer the composed `data sync` and `data files upload` workflows.
- Localization covers dictionary validate/pull/push plus the full raw `/localization/v4/*` API surface (assistant, config, glossary, key, language, module). Prefer `localization key translate-and-export` over running translate/generate/export by hand.
- Release covers deploy trigger and build status/read commands only.
- No direct artifact upload unless Blocks Release adds a confirmed artifact upload API.
- `projects create` creates a `dev`-only, single-application project. It cannot add environments to an existing project or create a non-`dev` one - those still go through the Blocks portal.
