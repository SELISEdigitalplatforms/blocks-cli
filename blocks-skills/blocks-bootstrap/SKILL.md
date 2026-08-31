---
name: blocks-bootstrap
description: "Get a user from any starting state to a working SELISE Blocks setup — CLI installed, logged in, project selected — using the `blocks` CLI, never raw fetch/curl. Detects state from `blocks auth status --json` and `blocks doctor --json`, then routes to a flow: select or create a project, inventory a project that already exists, resolve the app's OIDC client, add a social identity provider, create the first end user, scaffold a new web app, or wire an existing one. Use for a new user, for `not_logged_in`/`project_not_selected`, or whenever login/project/app state is unclear."
---

# Blocks — Bootstrap

## Purpose

Every other Blocks skill assumes three things are already true: the `blocks` CLI is installed, the user is logged in, and a project is selected. This skill establishes those, then routes to whichever flow the user actually needs.

It ends at **one user can log into the app**. Ongoing user administration after that belongs to `blocks-iam-users`, `blocks-iam-account`, and `blocks-iam-organizations`.

Everything here goes through `blocks`. Never a raw `fetch`/`curl` against a Blocks API, and never a workaround that skips the CLI's confirmation and dry-run discipline.

## When to use

- The user mentions SELISE Blocks and their login/project/app state is unknown.
- A command failed with `not_logged_in`, `project_not_selected`, `api_auth_failed`, or `refresh_token_rejected`.
- The user wants to build on Blocks and has not said where they are starting from.
- The user handed you an `x-blocks-key` and expects you to pick that project up.
- The user asks to log the CLI out of Blocks or clear the current CLI session.

Once the CLI is logged in, a project is selected, and the user is asking for a specific capability (data schemas, localization, mail, storage, roles), that capability's own skill owns the work — hand off rather than continuing here.

## State detection — probe, don't interrogate

Run all four before asking the user anything. None of them mutates, and none prints a token value. (`npm view` is a public registry lookup; if it fails offline, continue without the comparison.)

```bash
blocks --version
npm view @seliseblocks/cli-os version
blocks auth status --json
blocks doctor --json
```

`auth status` reports only existence and freshness — `missing`, `expired`, `valid`, or `available` (present, but with no recorded expiry) — for four tokens:

```json
{ "accountAccessToken": "expired", "accountRefreshToken": "missing",
  "projectAccessToken": "expired", "projectRefreshToken": "valid" }
```

The resolved account persists one exclusive mode: account AT+RT, or one
project's AT+RT. Missing account tokens while the project pair is valid is
normal project mode, not a broken login. Read it like this:

| Signal | State | Do this |
|---|---|---|
| `blocks --version` fails with command not found | CLI not installed | Ask before installing `npm install -g @seliseblocks/cli-os@latest`, then re-probe |
| `blocks --version` is behind `npm view @seliseblocks/cli-os version` | CLI outdated | Tell the user both versions and ask confirmation to run `npm install -g @seliseblocks/cli-os@latest`; never update without a yes. If they decline, continue on the old version and expect missing commands/flags/defaults relative to these skills — name the gap instead of silently working around it |
| All four tokens `missing` | No login in this resolved context | Local: `blocks login --account <name>`; Studio: report missing launcher bootstrap/context |
| Account AT and RT valid/available; project pair missing | Account mode | List/select a project or perform an account-only operation |
| `accountAccessToken` `expired`, `accountRefreshToken` `valid` | Recoverable | `blocks auth refresh --json`, then re-probe |
| Project AT and RT valid/available; account pair missing | Project mode | Ready for project commands |
| `projectAccessToken` `expired`, `projectRefreshToken` valid/available | Recoverable project mode | `blocks auth refresh --project --json`, then re-probe |
| An access token exists but its matching refresh token is missing | Non-refreshable session | Re-login locally; in Studio, report failed/expired bootstrap |
| Any token `available` | Present, expiry unknown — treat as usable but unproven | Continue; on `api_auth_failed`, re-login explicitly locally or report Studio bootstrap failure |
| Account mode, no project selected | Needs a project | [flows/project-selection.md](flows/project-selection.md) |
| Project mode and intended project selected | Ready | Confirm the project with the user, then route below |

**A selected project does not prove a usable session.** Selection is metadata;
project mode is usable only when its project token pair is present. Do not
require an account pair simultaneously: impersonation replaces it, and
`blocks deselect` exchanges the project pair for a fresh account pair.

From CLI 0.3.2 onward, any command may print an `Update available` notice on stderr, and `blocks doctor --json` reports `cliUpdateAvailable`. Treat either exactly like the version comparison above: inform the user, ask for confirmation, and only then update.

Use `blocks doctor --json` when something looks broken rather than merely undone — it checks Node version, credential storage backend, account and project token freshness in one pass. Its `detail` fields include the paths of the CLI's config and secret files. That is diagnostic output, not an invitation: never open, read, print, or quote those files. Interact with them only through `blocks` commands.

If credential storage itself is unreadable or corrupted (machine migration,
Windows profile change, Keychain reset), run `blocks auth remove <account>`, then
`blocks login --account <account>` locally. Never copy credentials from another
account or config directory.

## Agent execution context

### Local agent

Do not set `BLOCKS_CONFIG_DIR` for ordinary local work. Reuse the user's normal
OS-scoped CLI context and interact with it only through `blocks` commands. Probe
first. If no account is active in a non-interactive run, ask which account to
use; never pick another configured account. Run device login yourself with an
explicit name, relay the verification URL/code, and keep the process running
while the user approves it:

```bash
blocks login --account <name>
blocks auth status --account <name> --json
```

If the user supplied a tenant, use it. Otherwise list projects and ask before
changing selection. Once known, AI automation should pass both contexts
explicitly even though interactive local use may rely on `activeAccount`:

```bash
blocks use <tenantId> --account <name>
blocks <command> --account <name> --project <tenantId> --json
```

Use a temporary `BLOCKS_CONFIG_DIR` only when the user explicitly asks to test
isolation or a package build. A new directory is intentionally unauthenticated;
never copy the user's normal tokens into it.

### Code Studio agent

The launcher, not the agent, owns installation, isolation, and authentication
bootstrap. Never unset, replace, or guess `BLOCKS_CONFIG_DIR`. Start with
`blocks auth status --json`. If context/auth is missing, report that the Studio
session was not bootstrapped; do not fall back to OS state, inspect storage, or
copy credentials from another session. Device login is acceptable only when the
Studio product explicitly supports user approval for that isolated session.
Fully unattended Studio startup requires a launcher/backend bootstrap feature;
the current CLI does not provide one.

## Log in

If the user has never used SELISE Blocks at all, they need an account before this will work. Send them to `https://os.seliseblocks.com` to sign up, wait for them to confirm the account exists, then log in. Do not run `blocks login` first and let them discover the problem at the verification page.

```bash
blocks login --account <name>
```

The CLI authenticates itself with no setup: there is nothing to register in a portal first, no client id or secret to collect from the user, and nothing about how it authenticates to look up or report. It prints a verification URL and user code, opens the browser to the verification page when it can, then polls until authorized and stores account tokens that refresh themselves afterwards.

Run it yourself rather than only telling the user to run it, so you can read the printed code and URL back to them and confirm the result. Verify with `blocks auth status --json` afterwards — do not assume it worked.

## Log out

For "log me out of Blocks", run `blocks logout` for the resolved account. It revokes the current refresh token where possible and clears that account's local session data from the resolved config store. In automation, pass `--account <name>` explicitly; never log out a different configured account. Verify with `blocks auth status --account <name> --json`.

## Routing

| Situation | Go to |
|---|---|
| No project selected — the user gave a key, needs to choose one, or has none yet | [flows/project-selection.md](flows/project-selection.md) |
| Project selected, and the user wants to know what is already set up in it | [flows/existing-project.md](flows/existing-project.md) |
| Nobody can log into the app — OIDC client, identity provider, or OIDC not enabled | [flows/oidc-client.md](flows/oidc-client.md) |
| The user asked for Google, Microsoft, or other social sign-in | [flows/social-idp.md](flows/social-idp.md) |
| Login is configured but no end user exists yet | [flows/first-user.md](flows/first-user.md) |
| Building a frontend from scratch | [flows/new-web-app.md](flows/new-web-app.md) |
| An existing frontend needs to talk to Blocks | [flows/existing-app.md](flows/existing-app.md) |

A user starting from nothing usually walks it in this order: project selection → OIDC client (and social provider, if they want it) → new web app → first user. Someone handed a key and asking what exists starts at project selection, then the inventory flow, and goes wherever its gap list points.

Once one user can log in, bootstrap is over. Hand off to each capability's own skill for data, localization, mail, storage, IAM, and release work, and to `blocks-iam-users`/`blocks-iam-account` for further user work.

Two skills are deliberately **not** on the build path — `blocks new web` already wires both correctly, so loading them by default is wasted reading:

- `blocks-iam-sso-oidc-implementation` — only when hosted login misbehaves, or the user is extending the scaffolded auth flow. A scaffold whose login works needs nothing from it.
- `blocks-frontend-local-https` — only when actually setting up the local HTTPS dev loop (hosts entry, cert, dev server).

## Hard rules

- **Ask the user before installing or upgrading the global CLI.** Never run `npm install -g` on your own initiative.
- **If the user supplied an `x-blocks-key`, use it directly.** Do not show a picker, and do not list projects to "confirm" a choice they already made.
- **If they did not, list the projects and ask.** Never silently continue on a prior session's cached selection.
- **`--dry-run` before `--yes` on every cloud mutation.** Show the user the exact action, then wait for approval. Never add `--yes` to a call they have not approved.
- **Never expose secrets, tokens, refresh tokens, client secrets, cookies, JWTs, or passwords** — not in output, not in files, not in commits.
- **Never invent a project key, domain, API URL, or client id.** If you cannot read it from a command, ask.
- **Treat a GraphQL response carrying an `errors` array as a failure** even when the HTTP status is 200.
- **An unknown command or flag usually means the CLI is outdated.** Compare `blocks --version` against `npm view @seliseblocks/cli-os version` before working around it.
- **Run CLI commands sequentially per config directory.** Authentication transitions are mutex-protected; parallel invocations can fail with `auth_transition_busy`.

## Known error codes

| Code | Fix |
|---|---|
| `not_logged_in`, `refresh_token_rejected` | Local: `blocks login --account <account>`; Studio: require bootstrap or explicitly supported device approval |
| `account_not_configured` | Run `blocks login --account <account>` in the same resolved config store; never borrow another account |
| `account_not_selected` | Pass `--account <account>` or log in that named account; never choose one silently |
| `account_session_suspended` | Run `blocks deselect` before the account-only operation, then reselect when needed |
| `auth_transition_busy` | Wait for the other CLI process using this config directory, then retry sequentially |
| `device_login_denied` | The user denied approval; start a new login only when they ask |
| `device_login_expired` | Re-run `blocks login --account <account>` and complete approval before expiry |
| `device_login_failed` | Correct the identity-provider reason reported in `message`, then retry |
| `device_login_network_error` | Restore identity-provider connectivity, then restart login |
| unreadable or stale local auth storage | Local: `blocks auth remove <account>`, then `blocks login --account <account>`; Studio: replace/rebootstrap the isolated session |
| `project_not_selected` | `blocks use <x-blocks-key>`, or `--project <tenantId>` for one command |
| `project_refresh_token_missing` | Run `blocks login --account <account>`, then select the project again |
| `missing_project_name` | Pass a name: `blocks projects create "<name>"` |
| `invalid_project_name` | Use a project name between 3 and 100 characters |
| `project_create_failed` | Inspect `message`, then run `blocks projects list --json` before retrying |
| `no_tenant_group` | Pass a known `--repo-id` to `release builds list` |
| `api_auth_failed` | `blocks auth status --json`, then log in again |
| `impersonation_invalid_client` | Not a stale token. Give an admin the CLI client id printed in the error and have them register that client for project impersonation. Re-login, reselect, and AuthController config changes will not fix it. |
