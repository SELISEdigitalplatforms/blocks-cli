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

Once the CLI is logged in, a project is selected, and the user is asking for a specific capability (data schemas, localization, mail, storage, roles), that capability's own skill owns the work — hand off rather than continuing here.

## State detection — probe, don't interrogate

Run all three before asking the user anything. None of them mutates, and none prints a token value.

```bash
blocks --version
blocks auth status --json
blocks doctor --json
```

`auth status` reports only existence and freshness — `missing`, `expired`, or `valid` — for four tokens:

```json
{ "accountAccessToken": "expired", "accountRefreshToken": "missing",
  "projectAccessToken": "expired", "projectRefreshToken": "valid" }
```

Read it like this:

| Signal | State | Do this |
|---|---|---|
| `blocks --version` fails with command not found | CLI not installed | Ask before installing `npm install -g @seliseblocks/cli-os@latest`, then re-probe |
| `accountAccessToken` and `accountRefreshToken` both `missing` | Never logged in on this machine | `blocks login` |
| `accountAccessToken` `expired`, `accountRefreshToken` `missing` | Session dead, cannot self-refresh | `blocks login` again |
| `accountAccessToken` `expired`, `accountRefreshToken` `valid` | Recoverable | `blocks auth refresh --json`, then re-probe |
| Account tokens fine, no project selected | Needs a project | [flows/project-selection.md](flows/project-selection.md) |
| Account tokens fine, project selected | Ready | Confirm the project with the user, then route below |

**A selected project does not prove a usable session.** `blocks doctor --json` can report `"Project selected": ok: true` with a valid `projectRefreshToken` while the account session behind it is already dead — the selection is cached local state, not a live login. Always read the account rows first; project rows mean nothing without them.

Use `blocks doctor --json` when something looks broken rather than merely undone — it checks Node version, credential storage backend, account and project token freshness in one pass. Its `detail` fields include the paths of the CLI's config and secret files. That is diagnostic output, not an invitation: never open, read, print, or quote those files. Interact with them only through `blocks` commands.

If credential storage itself is unreadable or corrupted (machine migration, Windows profile change, Keychain reset), `blocks auth remove <account>` clears cached tokens and restores the packaged default account. Then `blocks login`.

## Log in

If the user has never used SELISE Blocks at all, they need an account before this will work. Send them to `https://os.seliseblocks.com` to sign up, wait for them to confirm the account exists, then log in. Do not run `blocks login` first and let them discover the problem at the verification page.

```bash
blocks login
```

The CLI authenticates itself with no setup: there is nothing to register in a portal first, no client id or secret to collect from the user, and nothing about how it authenticates to look up or report. It prints a verification URL and user code, opens the browser to the verification page when it can, then polls until authorized and stores account tokens that refresh themselves afterwards.

Run it yourself rather than only telling the user to run it, so you can read the printed code and URL back to them and confirm the result. Verify with `blocks auth status --json` afterwards — do not assume it worked.

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

Once one user can log in, bootstrap is over. Hand off: `blocks-iam-users` and `blocks-iam-account` for further user work, `blocks-iam-sso-oidc-implementation` for app-side login code, `blocks-frontend-local-https` for the local HTTPS dev loop, and each capability's own skill for data, localization, mail, storage, and release work.

## Hard rules

- **`blocks skill` and `blocks sdk client` do not exist.** They are not missing features to work around; the CLI's test suite asserts they stay unexposed. Never suggest either.
- **Ask the user before installing or upgrading the global CLI.** Never run `npm install -g` on your own initiative.
- **If the user supplied an `x-blocks-key`, use it directly.** Do not show a picker, and do not list projects to "confirm" a choice they already made.
- **If they did not, list the projects and ask.** Never silently continue on a prior session's cached selection.
- **`--dry-run` before `--yes` on every cloud mutation.** Show the user the exact action, then wait for approval. Never add `--yes` to a call they have not approved.
- **Never expose secrets, tokens, refresh tokens, client secrets, cookies, JWTs, or passwords** — not in output, not in files, not in commits.
- **Never invent a project key, domain, API URL, or client id.** If you cannot read it from a command, ask.
- **Treat a GraphQL response carrying an `errors` array as a failure** even when the HTTP status is 200.
- **An unknown command or flag usually means the CLI is outdated.** Compare `blocks --version` against `npm view @seliseblocks/cli-os version` before working around it.

## Known error codes

| Code | Fix |
|---|---|
| `not_logged_in`, `refresh_token_rejected` | `blocks login` |
| unreadable or stale local auth storage | `blocks auth remove <account>`, then `blocks login` |
| `project_not_selected` | `blocks use <x-blocks-key>`, or `--project <tenantId>` for one command |
| `api_auth_failed` | `blocks auth status --json`, then log in again |
| `impersonation_invalid_client` | Not a stale token. The account's OIDC client is not registered for impersonation — `blocks auth config get` and have an admin register it. Re-login and reselect will not fix this one. |
