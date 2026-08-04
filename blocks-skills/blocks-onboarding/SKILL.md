---
name: blocks-onboarding
description: "Onboard a user into SELISE Blocks before any other Blocks skill can run, using the `blocks` CLI — never raw API calls. Detects current state (CLI installed?, logged in?, project selected?) via `blocks auth status --json`/`doctor --json` and closes each gap: install, `login` (device-code, no setup needed), list/select a project (`projects create` is currently disabled — new projects come from the portal), `blocks init`, then resolve/create the app's OIDC client via `auth oidc-clients` (no portal needed) before handing off to `blocks new web`. Use when a user is new to Blocks, asks how to get started, or hits `not_logged_in`/`project_not_selected` from another command."
---

# Blocks — Onboarding

Every other Blocks skill assumes: the `blocks` CLI is installed, the user is logged in (`login`), and a project is selected (`use`). This skill detects which of those is missing and closes the gap. **Everything here goes through `blocks` — never a raw `fetch`/`curl` against `api.seliseblocks.com`.**

`blocks-cli`'s own [AI_USAGE_GUIDE.md](../../blocks-cli/AI_USAGE_GUIDE.md) is the command-level ground truth (exact flags, defaults, failure codes); this skill is the conversational flow around it — what to ask, what's portal-only, and in what order.

## Probe first, ask second

Run `blocks auth status --json` and branch on the result — don't interrogate the user about state that's discoverable:

| Signal | State | Do this |
|---|---|---|
| command not found | CLI not installed | `npm install -g @seliseblocks/cli-os`, then re-probe |
| `accountAccessToken`/`accountRefreshToken` both `"missing"` | Never logged in | Step 1 — `login` |
| logged in, no project selected (check `blocks doctor --json`'s "Project selected" check) | No project selected | Step 2 — list/`use` |
| logged in, project selected | Ready | Confirm the project with the user — always show the full accessible-project list and which one is currently selected, never silently continue on a prior session's selection — then hand off to the skill/task that brought you here |

If anything looks broken rather than simply "not yet done" (unreadable/stale local token storage after a machine migration, Windows profile change, Keychain reset), run `blocks doctor --json` for the fuller diagnostic — it checks Node version, config/token/secret file locations, and token freshness in one pass. If storage itself is unreadable or corrupted, `blocks auth remove <account>` clears cached tokens and stored local credentials (restoring the packaged default account), then re-run `login`.

## Step 1 — Log in

The CLI authenticates itself with no setup. There is no OIDC client to register in the portal for this, no client id/secret to collect from the user, and nothing about how the CLI does it to look up, print, or report — just log in:

```bash
blocks login
```

Device-code flow: it prints a verification URL and user code, opens the browser to the verification page when possible so the user only needs to click approve, then polls until the device is authorized; stores account access and refresh tokens and auto-refreshes later. Run it yourself rather than only telling the user to run it, so you can read the printed code/URL and confirm the result right after.

Verify with `blocks auth status --json` — re-run after login rather than assuming it worked.

## Step 2 — Project

Ask **what the user wants to build** and whether they already have a project, rather than assuming:

```bash
blocks projects list --json
```

Always show the full list of accessible projects, and if one already appears selected, say which one — never silently continue on a prior session's selection. If projects exist, confirm which one (and which environment) the user wants; never guess.

**`projects create` is currently disabled in this CLI build** (commented out pending a product decision — there is no CLI path to create a new project). If none of the listed projects fit, tell the user a new project must be created from the Blocks portal first; once they confirm it exists, re-run `blocks projects list --json` and continue from here.

Then select it:

```bash
blocks use <x-blocks-key>
```

Project (impersonation) tokens are created lazily from the account session the first time a project-scoped command needs one — never ask the user for a project token directly. If an impersonated project token later gets stuck, rejected, or expired and `blocks auth refresh --project --json` doesn't fix it, recover with:

```bash
blocks deselect              # drops the selection and its cached impersonation token
blocks use <x-blocks-key>     # reselect the same x-blocks-key to force a fresh impersonation
```

## Step 3 — Local workspace + hand off

Run `blocks init` once per project directory to create `blocks.json`, `blocks/data/schemas/`, `blocks/data/rules.json`, and `.env.example` — the later data-gateway skills read/write these. Safe to re-run: it never overwrites files that already exist. (`init` does not create a localization folder or any release-related file — `blocks/localization/` only appears later, lazily, the first time `blocks localization pull` writes to it, and there is no `blocks/release/*` file at all.)

Then route to what the user actually wants:
- Building a frontend from scratch → resolve the app's public OIDC client first, then scaffold:
  - `blocks auth oidc-clients list --json` — check whether a client already registered for this project fits. If none fits, create one directly (no portal visit needed): `blocks auth oidc-clients save --client-display-name <appName> --redirect-uris https://<domain>:5173/login/callback --scope "openid profile" --require-pkce --register-as-identity-provider --dry-run --json`, then re-run with `--yes` after showing the dry-run output and getting approval. See **[blocks-iam-sso-oidc-configuration](../blocks-iam-sso-oidc-configuration/SKILL.md)** for the full decision tree and field-level gotchas.
  - `blocks new web <name> --x-blocks-key <tenantId> --app-domain <domain> --blocks-api-url https://api.seliseblocks.com --client-id <the-resolved-client-id>`. **Always pass `--client-id` and `--app-domain` explicitly** — omitting either drops `new web` into an interactive pick-list prompt with no non-interactive escape (not even to "skip"), which hangs a scripted/agent run with no stdin to answer it.
- Defining data / CRUD / localization / release on an existing project → hand off to the matching skill; the project is already selected via `blocks use`, so its commands can proceed directly.

## Gotchas

- **Only one OIDC client matters here, and it's not the CLI's.** The CLI authenticates itself with no setup — nothing to register, nothing portal-only about `blocks login` itself, and nothing about how it does so to look up or mention. The only OIDC client involved is the scaffolded app's *public* browser client for its own end-user login (Step 3) — and that no longer requires the portal either: `blocks auth oidc-clients list`/`save` resolve or create it entirely through the CLI on the project's impersonated token. The portal remains available if the user prefers it, but it's an alternative, not a requirement. Don't tell a user they need to register anything before `blocks login` will work, and don't send them to the portal for the app's OIDC client by default.
- **`blocks new web` hangs a non-interactive run if `--client-id` or `--app-domain` is omitted** — it drops into an interactive pick-list (even to offer "skip") with no stdin to answer it in an agent-driven session. Always resolve both explicitly first (Step 3) rather than omitting either and hoping for a graceful default.
- **Never open, read, print, or expose the CLI's local storage files** (its config/token/secret files on disk) or anything inside them — client ids, root tenant id, account names, tokens. Only ever interact with them through `blocks` commands, never by inspecting the files directly. `auth status`/`doctor` only ever report token state (`missing`/`valid`/`expired`), never the value.
- **Known CLI error codes and fixes** (from the CLI's own error handling): `not_logged_in` → `blocks login`; `refresh_token_rejected` → `blocks login`; unreadable/stale local auth storage → `blocks auth remove <account>` then `blocks login`; `project_not_selected` → `blocks use <x-blocks-key>` (or pass `--project <tenantId>` for a single one-off command); `api_auth_failed` → `blocks auth status --json` then log in again; `impersonation_invalid_client` → not a stale-token problem, the account's OIDC client isn't registered for impersonation — check `blocks auth config get` and have an admin register it, `login`/`deselect`+`use` won't fix this one.
- **`--dry-run` before `--yes`** on every mutating command (`auth oidc-clients save`, `data schema push`/`data rules deploy`, `localization push`, `release deploy`) — this recurs in every skill that mutates project state.
