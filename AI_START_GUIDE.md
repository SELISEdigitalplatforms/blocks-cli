# Blocks AI Start Guide

Use this guide as the first stop when an AI agent can enter the Blocks workflow from any position. It routes the agent to the right source of truth without assuming the user starts from a clean install, a selected project, or a scaffolded app.

## First Decision

Identify which job the user is asking for:

| User situation | Start here | Why |
|---|---|---|
| New user, unknown login/project/app state | Install/probe first, then `blocks skill show blocks-onboarding` | Do not run onboarding until the CLI exists; then detect login, project selection, `blocks init`, OIDC client, and app scaffold gaps. |
| Building or changing a Blocks application | `blocks skill list`, then `blocks skill show <relevant-skill>` | Skills own the conversational workflow for app work. |
| Writing frontend app code with the SDK | `blocks-client/AI_USAGE_GUIDE.md` plus the relevant skill | The client guide owns SDK rules and method map; skills own task flow. |
| Running CLI/admin/project operations | `blocks-cli/AI_USAGE_GUIDE.md` plus the relevant skill | The CLI guide owns exact flags, command behavior, and failure handling. |
| Maintaining this monorepo's packages | Package README, package `AI_USAGE_GUIDE.md`, then source/tests | Source is allowed only when the task is about the packages themselves. |
| Debugging an error | The error's package guide, then the matching skill | Avoid bypassing supported CLI/SDK paths with raw API calls. |

## Install Commands

Install the CLI globally where the agent or developer will run terminal operations:

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

Do not install the global CLI automatically. If `blocks --version` fails with "not recognized" or "command not found", ask the user whether to install it:

```bash
npm install -g @seliseblocks/cli-os@latest
```

If the task is maintaining this monorepo instead of operating on a user Blocks app, do not require the global CLI. Use the source checkout after installing/building dependencies:

```bash
cd blocks-cli
npm install
npm run build
node bin/run.js --version
```

Install or update the SDK inside a user application:

```bash
npm install @seliseblocks/client@latest
```

## Universal Probe

When state is unknown and the installed CLI is available, start with read-only commands:

```bash
blocks --version
blocks --help
blocks auth status --json
blocks doctor --json
blocks skill list --json
```

If `blocks` is missing, stop the probe and ask before installing the global package. Do not claim the onboarding skill is runnable until the CLI exists.

Do not read local CLI storage files directly. If auth or project state is broken, use CLI commands such as `blocks login`, `blocks auth remove <account>`, `blocks projects list --json`, and `blocks use <tenantId>`.

## Start From Common Positions

### I have nothing installed

Read `blocks-cli/AI_USAGE_GUIDE.md`, ask the user before installing the CLI with the command above, verify `blocks --version`, then run:

```bash
blocks skill show blocks-onboarding
```

Follow that skill before attempting Data, IAM, Localization, Release, storage, mail, notification, or app-code work.

### I am logged in but no project is selected

Use the onboarding skill. The short path is:

```bash
blocks projects list --json
blocks use <projectTenantId>
blocks projects get --json
```

Show the accessible project list and the selected project to the user before mutating project resources.

### I am inside an existing Blocks app

Run the relevant skill first, based on the task:

| Task | Skill |
|---|---|
| Data schema/rules/configuration | `blocks-data-gateway-configuration` |
| Runtime CRUD/GraphQL in app code | `blocks-data-gateway-crud` |
| Files/DMS upload/download | `blocks-data-storage` |
| Runtime translations in app code | `blocks-localization-implementation` |
| Translation authoring/push/pull | `blocks-localization-configuration` |
| Hosted login callback/login button | `blocks-iam-sso-oidc-implementation` |
| OIDC client/identity provider setup | `blocks-iam-sso-oidc-configuration` |
| Current user's account/profile/password | `blocks-iam-account` |
| Admin user management | `blocks-iam-users` |
| Roles and permissions | `blocks-iam-access-control` |
| MFA | `blocks-iam-mfa` |
| Organizations/signup settings | `blocks-iam-organizations` |
| Local HTTPS dev loop | `blocks-frontend-local-https` |
| Release deployment | `blocks-release-deployment` |
| Secrets | `blocks-secrets` |
| Mail settings/templates | `blocks-mail` |
| Notification channel configuration | `blocks-notification` |
| Sending/reading notifications | `blocks-notifier` |
| Storage provider configuration | `blocks-storage-configuration` |

Then use `blocks-client/AI_USAGE_GUIDE.md` for app-code method rules and `blocks-cli/AI_USAGE_GUIDE.md` for terminal command flags.

If the app already exists and needs the SDK, install or update it from the app root:

```bash
npm install @seliseblocks/client@latest
```

### I need to scaffold a new app

Use onboarding first. For non-interactive AI runs, gather required values before `new web` so prompts do not hang:

```bash
blocks projects get --json
blocks auth oidc-clients list --json
blocks new web <appName> --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl> --client-id <publicOidcClientId>
```

Do not invent a project key, domain, or client id. The generated app includes `@seliseblocks/client`; run `npm install` inside the app to resolve the latest compatible package version from npm.

### I need to configure cloud resources

Use the matching skill and dry-run first:

```bash
blocks <command> --dry-run --json
```

Only run the real mutation with `--yes` after the user approves the exact action. This applies to schema push, rules deploy, localization push, release deploy, OIDC/client credential changes, users, roles, permissions, MFA config, organizations, secrets, mail, notification, storage config, and similar project resources.

### I am maintaining the CLI or SDK packages

This is package-source work, not consumer app work:

1. Read the package README.
2. Read the package `AI_USAGE_GUIDE.md`.
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

1. `blocks skill show <name>` for task flow and handoffs.
2. `blocks-cli/AI_USAGE_GUIDE.md` for CLI command contracts.
3. `blocks-client/AI_USAGE_GUIDE.md` for SDK app-code contracts.
4. Package source/tests only when maintaining this monorepo's packages.

Do not duplicate business logic in generated apps. Use `blocks` commands for supported admin/project operations and `@seliseblocks/client` for supported app-code operations.

## Guardrails

- Never expose local CLI tokens, refresh tokens, client secrets, cookies, JWTs, connection strings, or private credentials.
- Never inspect CLI local storage files directly.
- Never use raw `fetch`/`curl` against Blocks APIs when the CLI or SDK supports the capability.
- Do not add `/api` after `/v4` in SDK routes.
- SDK app code sends `x-blocks-key`, never `ProjectKey` or `projectKey`.
- Frontend code must not contain client secrets.
- Treat GraphQL responses with an `errors` array as failures even if HTTP status is 200.
- Keep local storage in apps for UI drafts/preferences or explicit demo data only, not real backend data.
- Verify with tests, build, read-only health checks, or targeted searches before calling work complete.
