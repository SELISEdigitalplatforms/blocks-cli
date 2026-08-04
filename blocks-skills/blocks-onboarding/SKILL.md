---
name: blocks-onboarding
description: "Onboard a user into SELISE Blocks before any other Blocks skill can run, using the blocks-os CLI — never raw API calls. Detects current state (CLI not installed, not logged in, no project selected) via `blocks-os auth status --json`. The CLI authenticates itself with no setup — there is nothing to register for the CLI's own login and nothing about how it does so to look up or report; it's just `blocks-os login`, a device-code flow that prints a verification URL/code, opens the browser, and polls until approved. Closes each gap: install `@seliseblocks/cli-os`, log in with `login`, list/create/select a project with `projects list`/`projects create`/`use`, run `blocks-os init` for local workspace files, then hand off to `blocks-os new web` scaffolding. Use whenever a user is new to Blocks, asks how to get started, hits `not_logged_in`/`project_not_selected` from another `blocks-os` command, or when project/login state is unknown."
---

# Blocks — Onboarding

Every other Blocks skill assumes: the `blocks-os` CLI is installed, the user is logged in (`login`), and a project is selected (`use`). This skill detects which of those is missing and closes the gap. **Everything here goes through `blocks-os` — never a raw `fetch`/`curl` against `api.seliseblocks.com`.**

`blocks-cli-os`'s own [AI_USAGE_GUIDE.md](../../blocks-cli-os/AI_USAGE_GUIDE.md) is the command-level ground truth (exact flags, defaults, failure codes); this skill is the conversational flow around it — what to ask, what's portal-only, and in what order.

## Probe first, ask second

Run `blocks-os auth status --json` and branch on the result — don't interrogate the user about state that's discoverable:

| Signal | State | Do this |
|---|---|---|
| command not found | CLI not installed | `npm install -g @seliseblocks/cli-os`, then re-probe |
| `accountAccessToken`/`accountRefreshToken` both `"missing"` | Never logged in | Step 1 — `login` |
| logged in, no project selected (check `blocks-os doctor --json`'s "Project selected" check) | No project selected | Step 2 — list/create/`use` |
| logged in, project selected | Ready | Confirm the project with the user — always show the full accessible-project list and which one is currently selected, never silently continue on a prior session's selection — then hand off to the skill/task that brought you here |

If anything looks broken rather than simply "not yet done" (unreadable/stale local token storage after a machine migration, Windows profile change, Keychain reset), run `blocks-os doctor --json` for the fuller diagnostic — it checks Node version, config/token/secret file locations, and token freshness in one pass. If storage itself is unreadable or corrupted, `blocks-os auth remove <account>` clears cached tokens and stored local credentials (restoring the packaged default account), then re-run `login`.

## Step 1 — Log in

The CLI authenticates itself with no setup. There is no OIDC client to register in the portal for this, no client id/secret to collect from the user, and nothing about how the CLI does it to look up, print, or report — just log in:

```bash
blocks-os login
```

Device-code flow: it prints a verification URL and user code, opens the browser to the verification page when possible so the user only needs to click approve, then polls until the device is authorized; stores account access and refresh tokens and auto-refreshes later. Run it yourself rather than only telling the user to run it, so you can read the printed code/URL and confirm the result right after.

Verify with `blocks-os auth status --json` — re-run after login rather than assuming it worked.

## Step 2 — Project

Ask **what the user wants to build** and whether they already have a project, rather than assuming:

```bash
blocks-os projects list --json
```

Always show the full list of accessible projects, and if one already appears selected, say which one — never silently continue on a prior session's selection. If projects exist, confirm which one (and which environment) the user wants; never guess. If none exist, propose a default (one project, one `dev` environment — more environments can be added later) and confirm before creating:

```bash
blocks-os projects create <name> --env dev --dry-run --json   # show the plan first
blocks-os projects create <name> --env dev --yes --json       # only after the user approves
```

Then select it:

```bash
blocks-os use <x-blocks-key>
```

Project (impersonation) tokens are created lazily from the account session the first time a project-scoped command needs one — never ask the user for a project token directly. If an impersonated project token later gets stuck, rejected, or expired and `blocks-os auth refresh --project --json` doesn't fix it, recover with:

```bash
blocks-os deselect              # drops the selection and its cached impersonation token
blocks-os use <x-blocks-key>     # reselect the same x-blocks-key to force a fresh impersonation
```

## Step 3 — Local workspace + hand off

Run `blocks-os init` once per project directory to create `blocks.json`, `blocks/data/schemas/`, `blocks/data/rules.json`, `blocks/localization/`, `blocks/release/deploy.json`, and `.env.example` — the later data-gateway, localization, and release skills read/write these. Safe to re-run: it never overwrites files that already exist.

Then route to what the user actually wants:
- Building a frontend from scratch → `blocks-os new web <name> --x-blocks-key <tenantId> --app-domain <domain> --blocks-api-url https://api.seliseblocks.com [--client-id <public-oidc-client-id>]`. **This app's own end-user login needs a separate *public* OIDC client**, registered portal-only at `https://os.seliseblocks.com` — see **[blocks-iam-sso-oidc-configuration](../blocks-iam-sso-oidc-configuration/SKILL.md)**. Without `--client-id`, the scaffold still generates but the login page shows a setup notice until one is added.
- Defining data / CRUD / localization / release on an existing project → hand off to the matching skill; the project is already selected via `blocks-os use`, so its `flows/` can proceed straight to its own commands.

## Gotchas

- **Only one OIDC client matters here, and it's not the CLI's.** The CLI authenticates itself with no setup — nothing to register, nothing portal-only about `blocks-os login` itself, and nothing about how it does so to look up or mention. The only OIDC client a user registers is the scaffolded app's *public* browser client for its own end-user login (Step 3, `new web --client-id`) — that registration is portal-only and human-driven, same rule as all identity-provider provisioning on this platform. Don't tell a user they need to register anything before `blocks-os login` will work.
- **Never open, read, print, or expose the CLI's local storage files** (its config/token/secret files on disk) or anything inside them — client ids, root tenant id, account names, tokens. Only ever interact with them through `blocks-os` commands, never by inspecting the files directly. `auth status`/`doctor` only ever report token state (`missing`/`valid`/`expired`), never the value.
- **Known CLI error codes and fixes** (from the CLI's own error handling): `not_logged_in` → `blocks-os login`; `refresh_token_rejected` → `blocks-os login`; unreadable/stale local auth storage → `blocks-os auth remove <account>` then `blocks-os login`; `project_not_selected` → `blocks-os use <x-blocks-key>`; `api_auth_failed` → `blocks-os auth status --json` then log in again.
- **`--dry-run` before `--yes`** on every mutating command (`projects create`, `data schema push`/`data rules deploy`, `localization push`, `release deploy`) — this skill's project creation is the first place that pattern shows up; it recurs in every other skill.
