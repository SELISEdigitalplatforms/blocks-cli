# Blocks AI Routing Guide

Use this guide as the first stop when an AI agent can enter the Blocks workflow from any position. It routes the agent to the right source of truth without assuming the user starts from a clean install, a selected project, or a scaffolded app.

## Fast path — check before reading further

Most sessions do not need this guide. Two cheap commands decide:

```bash
blocks auth status --json
blocks doctor --json
```

If a token pair is valid **and** a project is selected, the setup this guide
exists to establish is already done. **Skip the rest of this file** and go
straight to the skill for the capability the user asked about — data,
localization, IAM, mail, storage, release, notifications. Each skill states its
own prerequisites and links the one `blocks-cli/AGENT_GUIDE.md` section it
pairs with.

Read on only when one of these is true:

- `blocks --version` fails — the CLI is not installed.
- Every token reads `missing`, or an access token has no matching refresh token.
- No project is selected and the user has not named one.
- The user is scaffolding a new app, or wiring an existing app to Blocks for the first time.
- A command failed with `not_logged_in`, `project_not_selected`, `api_auth_failed`, or `refresh_token_rejected`.

Reading this whole guide plus the bootstrap skill costs roughly 6k tokens. Skip
it when the fast path clears.

## First Decision

Identify which job the user is asking for:

| User situation | Start here | Why |
|---|---|---|
| New user, unknown login/project/app state | Install/probe first, then follow setup/bootstrap guidance | Do not proceed until the CLI exists; then detect login, project selection, `blocks init`, OIDC client, and app scaffold gaps. |
| Building or changing a Blocks application | The package guide for the surface being changed | Package guides own command and SDK contracts for app work. |
| Writing frontend app code with the SDK | `blocks-client/AGENT_GUIDE.md` | The client guide owns SDK rules and method map. |
| Running CLI/admin/project operations | `blocks-cli/AGENT_GUIDE.md` | The CLI guide owns exact flags, command behavior, and failure handling. |
| Maintaining this monorepo's packages | Package README, package `AGENT_GUIDE.md`, then source/tests | Source is allowed only when the task is about the packages themselves. |
| Debugging an error | The error's package guide | Avoid bypassing supported CLI/package paths with raw API calls. |

## Install Commands

**Ask the user before installing the global CLI — never install it automatically.**

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

If the task is maintaining this monorepo instead of operating on a user Blocks
app, use the source checkout instead (`blocks-cli/README.md`'s Development
section) and skip the global install. See `blocks-client/README.md` for
installing the SDK inside a user application.

## Universal Probe

When state is unknown and the installed CLI is available, start with read-only commands. `auth status` is the minimal state probe; `doctor` performs a cache-only diagnostic and does not refresh tokens:

```bash
blocks --version
blocks auth status --json
blocks doctor --json
```

For command discovery, see `blocks-cli/AGENT_GUIDE.md`'s "Looking commands up
cheaply" — it also covers why not to use `<command> --help`.

If `blocks` is missing, stop the probe and ask before installing the global package.

Do not read local CLI storage files directly. If local auth or project state is broken, use CLI commands such as `blocks login --account <account>`, `blocks auth remove <account>`, `blocks projects list --account <account> --json`, and `blocks use <tenantId> --account <account>`.

## Agent Context

Two rules apply before any routing decision:

- **Leave `BLOCKS_CONFIG_DIR` alone.** It is the whole isolation boundary. Never set, unset, or guess it.
- **Never silently choose a configured account.** If no account is known, ask.

Once both are known, pass `--account <name>` and `--project <tenantId>`
explicitly — see `blocks-cli/AGENT_GUIDE.md`'s "AI agent startup" for why.

The `blocks-bootstrap` skill owns the rest: how to read the four token states,
the account/project token exchange, login, and Code Studio launcher context.
Go there rather than re-deriving any of it here.

## Start From Common Positions

### I have nothing installed

Read `blocks-cli/AGENT_GUIDE.md`, ask the user before installing the CLI with the command above, then verify `blocks --version` before attempting Data, IAM, Localization, Release, storage, mail, notification, or app-code work.

### I am logged in but no project is selected

Use the setup/bootstrap flow. The short path is:

```bash
blocks projects list --json
blocks use <projectTenantId>
blocks projects get --json
```

Show the accessible project list and the selected project to the user before mutating project resources.
If no suitable project exists, ask the user before creating one - `blocks projects create "<name>"` makes a single `dev`-environment project and accepts the Blocks terms on their behalf. Never call the project APIs directly. Adding more environments to an existing project remains portal-only.

### I am inside an existing Blocks app

Use the matching Blocks skill as the routing and safety layer, then the CLI or client package guide for exact terminal flags or app-code methods:

| Task | Guide |
|---|---|
| Data schema/rules/configuration | `blocks-cli/AGENT_GUIDE.md` |
| Runtime CRUD/GraphQL in app code | `blocks-client/AGENT_GUIDE.md` |
| Files/DMS upload/download | `blocks-skills/blocks-data-storage/SKILL.md`, then the CLI or client guide for the chosen surface |
| Runtime translations in app code | `blocks-client/AGENT_GUIDE.md` |
| Translation authoring/push/pull | `blocks-cli/AGENT_GUIDE.md` |
| Hosted login callback/login button | `blocks-client/AGENT_GUIDE.md` |
| OIDC client/identity provider setup | `blocks-cli/AGENT_GUIDE.md` |
| Current user's account/profile/password | `blocks-client/AGENT_GUIDE.md` |
| Admin user management | `blocks-skills/blocks-iam-users/SKILL.md`, then the CLI or client guide |
| Roles and permissions | `blocks-skills/blocks-iam-access-control/SKILL.md`, then the CLI or client guide |
| MFA | `blocks-skills/blocks-iam-mfa/SKILL.md`, then the CLI or client guide |
| Organizations/signup settings | `blocks-skills/blocks-iam-organizations/SKILL.md`, then the CLI or client guide |
| Local HTTPS dev loop | Scaffolded app README/scripts |
| Release deployment | `blocks-cli/AGENT_GUIDE.md` |
| Secrets | `blocks-cli/AGENT_GUIDE.md` |
| Mail settings/templates | `blocks-cli/AGENT_GUIDE.md` |
| Notification channel configuration | `blocks-cli/AGENT_GUIDE.md` |
| Sending/reading notifications | `blocks-skills/blocks-notifier/SKILL.md`, then the CLI or client guide |
| Storage provider configuration | `blocks-cli/AGENT_GUIDE.md` |

Then use `blocks-client/AGENT_GUIDE.md` for app-code method rules and `blocks-cli/AGENT_GUIDE.md` for terminal command flags.

If the app already exists and needs the SDK, install or update it from the app root:

```bash
npm install @seliseblocks/client@latest
```

### I need to scaffold a new app

Use the setup/bootstrap flow first. For non-interactive AI runs, gather required values before `new web`; otherwise the CLI fails with `interactive_input_required`:

```bash
blocks projects get --json
blocks auth oidc-clients list --json
blocks new web <appName> --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl> --client-id <publicOidcClientId> --yes
```

Do not invent a project key, domain, or client id. `new web` may enable OIDC login in tenant AuthController; use `--yes` only after the user approves that possible mutation. Failure stops before scaffold files are written.

### I need to configure cloud resources

Use the matching CLI command and dry-run first:

```bash
blocks <command> --dry-run --json
```

Only run the real mutation with `--yes` after the user approves the exact action. This applies to schema push, rules deploy, localization push, release deploy, OIDC/client credential changes, users, roles, permissions, MFA config, organizations, secrets, mail, notification, storage config, and similar project resources.

### I am maintaining the CLI or SDK packages

This is package-source work, not consumer app work:

1. Read the package README.
2. Read the package `AGENT_GUIDE.md`.
3. Inspect the source and tests.
4. Make the smallest correct change.
5. Run the relevant package tests.

Common commands:

```bash
npm test
npm run build
cd blocks-cli
npm test
cd ../blocks-client
npm test
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Source Of Truth Order

Use the highest-level source that answers the question:

1. `blocks-cli/AGENT_GUIDE.md` for CLI command contracts.
2. `blocks-client/AGENT_GUIDE.md` for SDK app-code contracts.
3. Package source/tests only when maintaining this monorepo's packages.

Do not duplicate business logic in generated apps. Use `blocks` commands for supported admin/project operations and `@seliseblocks/client` for supported app-code operations.

## Guardrails

Beyond the repo-wide rules already in `AGENTS.md` and each package's
`AGENT_GUIDE.md` (secrets/credentials, local storage files, `/v4` routes,
`x-blocks-key`):

- Never use raw `fetch`/`curl` against Blocks APIs when the CLI or SDK supports the capability.
- Treat GraphQL responses with an `errors` array as failures even if HTTP status is 200.
- Keep local storage in apps for UI drafts/preferences or explicit demo data only, not real backend data.
- Verify with tests, build, read-only health checks, or targeted searches before calling work complete.
