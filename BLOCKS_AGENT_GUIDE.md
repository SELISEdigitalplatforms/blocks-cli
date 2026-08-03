# Blocks Platform - AI Agent Guide

## Purpose

Onboard a user into the Blocks ecosystem by getting them to a working, selected Blocks project - then build or continue a Blocks web application from the current workspace on top of it.

## Happy path (quick reference - each line is one of the full steps below)

0. Confirm what the user wants; get an app description if building one.
1. Check the CLI is installed and current.
2. Check auth state.
3. If needed, clean up stale local auth.
4. If not authenticated, log in yourself.
5. List projects; confirm, switch, or create one - never assume a prior selection still holds.
6. Get the app domain from the selected project via `projects:get`.
7. If login is in scope, get the app's own OIDC client id (portal-only).
8. Scaffold a new app, or resume an existing one.
9. Install deps, init the workspace, trust the dev cert, run the dev server.
10. Define the data schema and push it.
11. Build the CRUD screen with the SDK.
12. Test end to end.
13. Optional: release deploy.

Full detail, branches, and guardrails for each of these are in the numbered steps below - this list is an index, not a substitute for reading them.

## Role

Build the app using real command output and the existing workspace state. Ask only for missing product decisions or required values that cannot be discovered locally.

If the user has not stated what they actually want (build a new app, continue an existing one, just create/select a project, or do a narrower data/localization/release task), ask them directly before picking a path. Do not guess the goal from a vague message.

When asking the user a question, be professional and explicit. State why the answer is needed and what format is expected, so the user can answer without guessing.

## Blocks skills scope

If a `blocks-skills` folder or installed Blocks skill is available, use it as task context for a deeper walkthrough of one narrow topic (IAM, SSO/OIDC config, localization implementation, data gateway, etc.) when this guide's step doesn't cover enough detail. If not, continue with this guide.

Do not stop to ask whether the skill pack is current. When the user provides the full Blocks repo, use the skills included in that repo.

Skill files are conversational context, not command ground truth - they can drift from the installed CLI. Before running any command a skill file gives you, confirm it's listed in top-level `blocks-os --help` (don't probe with `<command> --help` - see Global rules on why that's unsafe). (Confirmed drift: some skill files reference `auth:add`, `login:device`, and `auth:repair` - none of these exist in the current CLI's `--help` output. Do not run them.)

Do not invent missing Blocks behavior, do not fall back to raw API examples, and do not use old `PTOK`, `PTENANT`, `ACCOUNT_TENANT`, bearer-token, or impersonation-token flows.

## CLI vs SDK vs Skills - pick the right layer

| Layer | Use it for | Never use it for |
|---|---|---|
| `blocks-os` CLI | Control-plane/definition work: login/session, project list/create/select, schema pull/push, rules pull/deploy, data reload, localization pull/push, release deploy/status/list, scaffolding (`new web`), local workspace `init`/`doctor`. | Runtime record reads/writes from inside the running app - that's the SDK's job. Also never used from within generated app code. |
| `@seliseblocks/client` SDK (already a dependency in the generated app's `package.json`) | Everything inside the running app at runtime: browser OIDC login/callback, current-user info, actual collection CRUD (`blocksClient.data.collection<Entity>("EntityName")`), GraphQL queries, file/DMS helpers, localization loading/consumption in the UI. | Anything that mutates project-level config - schema/rules definitions, localization key authoring, release deploys. The SDK has no admin surface for these by design; it will not do it even if asked. |
| `blocks-skills/*/SKILL.md` | A deeper conversational walkthrough of one topic when this guide's step is too shallow. | Command ground truth - always verify command names/flags against `blocks-os --help` first (see staleness note above). |

In short: project-scoped **data work inside the app** (reading/writing actual records) goes through the SDK client, never the CLI. Project-scoped **definition/control work** - upsert a schema, pull/push schemas or rules, reload data config, push/pull localization keys, trigger or read a release - always goes through the CLI, never a hand-rolled API call.

## Global rules

- This rule is for app-building work (Steps 0-13 below): do not read `blocks-cli-os`/`blocks-client` source code to figure out behavior for building an app against them. Use `blocks-os --help`, `blocks-os doctor --json`, and each package's own `AI_USAGE_GUIDE.md` as ground truth instead. It does not apply when the task itself is maintaining, publishing, or debugging the CLI/SDK packages - that work reads their source normally.
- Never open, read, print, or otherwise expose the CLI's local storage files (its config/token/secret files on disk, wherever `doctor --json` says they live) or anything inside them - client ids, root tenant id, account names, tokens. These are internal to the CLI; only ever interact with them through `blocks-os` commands, never by inspecting the files directly.
- Use `blocks-os --help` (top-level, no subcommand) as command ground truth for what exists. Do not assume `blocks-os <command> --help` is a safe way to check a subcommand's flags - confirmed on this CLI version, most subcommands don't recognize `--help` as special and just run their real logic with it as a no-op arg (e.g. `login --help` performs an actual login attempt; `new web <name> --help` runs real arg validation). Never use `<command> --help` as a probe on a command with no other required arguments. Also note the top-level help's one-line usage strings are abbreviated and can omit real, working flags (e.g. `new web`'s `--blocks-api-url` isn't listed there but does work) - absence from top-level help isn't proof a flag doesn't exist either; when truly unsure, ask the user or infer from `--dry-run`/error output rather than guessing.
- A Blocks project must be confirmed selected (see Step 5) before creating or running any project-scoped command - data, localization, or release commands never run against an implicit or assumed project.
- After the workspace is confirmed, create or update `blocks-session-log.md` outside the generated project folder, then update it throughout the workflow with goal, cwd, phase, command, key output, decision, and next step; if file writing is unavailable, keep the same log in chat as `Session log`.
- `@seliseblocks/cli-os` (the CLI): if already installed, check whether a newer version is published and ask the user before updating - never update it silently.
- `@seliseblocks/client` (the frontend SDK): always install the latest published version - no need to ask, just keep it current.
- Never raw `fetch`/`curl` against Blocks APIs.
- Never use `PTOK`, `PTENANT`, `ACCOUNT_TENANT`, bearer-token shortcuts, or impersonation-token examples.
- Never collect secrets, tokens, cookies, JWTs, passwords, or private keys in chat.
- Never place secrets/tokens in frontend code or `.env` files.
- Login: `blocksClient.auth.idp.redirectToProvider()` to start, `blocksClient.auth.idp.callback()` on the callback page, `blocksClient.auth.userInfo()` for the current user.
- CRUD: `blocksClient.data.collection<Entity>("EntityName")`.
- Reuse the generated app's stack and components - don't rebuild from scratch.
- Always show `--dry-run` output before any `--yes` mutating command.
- Never guess a missing portal setting. If OIDC provider/client config is missing, stop and state exactly what's needed from the OS portal.
- When a step differs by OS, defer to the scaffold's own generated README rather than hardcoding OS-specific commands here.

## Token & session recovery (applies across Steps 2-5)

Recovery order, cheapest/least-disruptive first - never skip a cheaper step to jump straight to login:

1. `blocks-os auth:refresh --json` - refreshes the account token. Try this first for any account-token failure.
2. `blocks-os auth:refresh --project --json` - refreshes the project (impersonation) token when a project is already selected but its session looks stale.
3. `blocks-os deselect` then `blocks-os use <x-blocks-key>` - if the impersonated project token is stuck, rejected, or expired and a plain refresh doesn't fix it, clear it and reselect the same x-blocks-key to force a fresh impersonation. This does not touch the account session or change which x-blocks-key is selected.
4. `blocks-os login` - only when the account refresh token itself is missing, expired, or rejected, i.e. steps 1-3 don't apply because there's no account session left to refresh from. Run this yourself - don't just print the command and wait; execute it so you can read the verification URL/code and confirm the result via `blocks-os auth:status --json` immediately after.

Key facts to hold onto:

- Project tokens are never entered or requested directly - they come from impersonation, which the CLI performs lazily using the account token the first time a project-scoped command needs one. New project tokens always come from the account session via impersonation, not from the user.
- Selecting a different project (`blocks-os use <x-blocks-key>`) does not carry over the previous project's impersonation token - a fresh one is created for the newly selected x-blocks-key.
- `blocks-os deselect` explicitly drops the cached impersonation token along with the selected x-blocks-key. After deselect, the next `blocks-os use <x-blocks-key>` re-impersonates from scratch.
- Never fall back to raw `PTOK`/`PTENANT`/`ACCOUNT_TENANT`/bearer-token shortcuts to work around a token problem - use the recovery order above instead.

## Step 0 - Application discovery and workspace intent

- Use the current directory unless the user explicitly provides another path.
- If the current directory is already a Blocks app, continue from its current state.
- If the user has not described the app, ask one question: "Please describe the app you want to build, including its purpose and main screens or workflows."
- For a new app, choose a clean short folder name from the app idea. Do not create the folder manually; `blocks-os new web` creates it.

## Step 1 - Is the CLI installed, and current?

Run: `blocks-os --version`

- Not found -> `npm install -g @seliseblocks/cli-os@latest`, then continue to Step 2.
- Version printed -> check the latest published version (e.g. `npm view @seliseblocks/cli-os version`) and compare it to the installed one.
  - Same version -> continue to Step 2.
  - Newer version available -> ask the user: "A newer CLI version is available (installed `<x>`, latest `<y>`). Update now?"
    - Yes -> `npm install -g @seliseblocks/cli-os@latest`, then continue to Step 2.
    - No -> continue to Step 2 on the installed version.

## Step 2 - Auth state

Run: `blocks-os auth:status --json`. Read the output directly - field names are the account/project access/refresh token states (e.g. `accountAccessToken`, `accountRefreshToken`, `projectAccessToken`, `projectRefreshToken`), not a project identity; don't assume a fixed shape beyond that without checking the actual output.

The CLI authenticates itself with no setup - do not ask the user for a client id, token, cookie, JWT, private key, or other secret for this, and never look for or report what the CLI uses internally to do it. (A different client id - your project's own OIDC client id for the app's end-user login, which the user registers and gives you themselves - is collected later in Step 7. That one is fine to ask for; don't confuse it with the CLI's own login.)

- If `accountRefreshToken` is `"available"` (or `"valid"`/`"expired"` - anything but `"missing"`), continue to Step 5. The CLI refreshes tokens when needed; apply the Token & session recovery order above if a refresh fails.
- If `accountRefreshToken` is `"missing"`, go to Step 4 and run `blocks-os login` yourself.
- If `auth:status` reports unreadable or stale local auth storage, go to Step 3.

Whether a project is already selected, and which one, is not reliably reported by `auth:status`. Determine it in Step 5 by listing projects and cross-checking `blocks-os doctor --json`'s "Project selected" check - never assume from a prior session that the same project is still the right one.

## Step 3 - Local auth cleanup

Use this only when `blocks-os auth:status --json` or `blocks-os doctor --json` shows stale local auth state for an existing account.

If local auth storage is stale or unreadable after a machine migration, Windows profile change, Keychain reset, or corrupted token cache, show the local cleanup command only after confirming the account name:

```bash
blocks-os auth:remove <account>
```

Then re-check `blocks-os auth:status --json`.

Continue when `auth:status` can read local auth state.

## Step 4 - Login

Run `blocks-os login`. The command prints a verification URL and user code, opens the browser when possible, then waits for approval. If browser auto-open is unavailable, tell the user to open the printed URL and approve the code.

After login completes, run `blocks-os auth:status --json` and read it.

If `accountRefreshToken` is still `"missing"` after login, run `blocks-os login` again yourself and re-check `blocks-os auth:status --json` - the user only needs to approve the browser/device prompt, not type the command.

- `accountAccessToken` `"missing"` -> login failed; run `blocks-os login` again yourself.
- `accountAccessToken` present and `accountRefreshToken` not `"missing"` -> continue to Step 5.

After login succeeds, run `blocks-os doctor --json` and `blocks-os iam:me --json`. If `doctor` has no blocking auth failures and `iam:me` returns the current user, the login session and token storage are valid enough to continue - no need to know or report anything about how the CLI authenticates itself internally. Use `blocks-os logout` only when the user wants to revoke/remove local login tokens; use `blocks-os auth:remove <account>` only when cached tokens and stored local credentials should be cleared.

## Step 5 - Blocks project

This is the remote Blocks project, identified by its x-blocks-key, not the local filesystem workspace. Use the one-line project description from Step 0 when creating a new project; ask for a concise project name only if the description does not already imply one.

Never assume a project already selected in a prior session is still the right one - always re-confirm:

1. Run `blocks-os projects:list --json` unconditionally, even if a project looks already selected. This is a read-only call; the extra round trip is the cost of not acting on stale state.
2. Cross-check `blocks-os doctor --json`'s "Project selected" check to see which x-blocks-key (if any) is currently selected.
3. Show the user the full list of accessible project names/x-blocks-keys, clearly marking which one (if any) is currently selected, then ask:

"Here are your accessible projects: `<list>`. Currently selected: `<x-blocks-key or 'none'>`. Continue with this one, switch to another, or create a new project?"

- Continue current: keep the selected project and go to Step 6.
- Switch: ask which x-blocks-key from the list just shown, then run `blocks-os use <x-blocks-key>` - this drops the old project's impersonation and re-impersonates fresh for the new x-blocks-key (see Token & session recovery).
- Create new: run `blocks-os projects:create <name> --env dev --dry-run --json`, confirm the plan, then `--yes --json`, then `blocks-os use <x-blocks-key>`.

If `projects:list` fails with an auth error, apply the Token & session recovery order above, then retry before asking the user anything.

## Step 6 - Application domain

Run: `blocks-os projects:get --json` with no x-blocks-key argument - it reads the project already selected in Step 5 - and read the application/domain/origin value from the returned project data. The exact field name isn't guaranteed by the CLI's types, so read what's actually there rather than assuming one fixed path.

Prefer `projects:get` on the selected project as the source of truth - do not ask the user for the app domain as a first move, and never ask the portal to look it up for you.

- A valid app domain is present -> use it.
- Absent -> the selected project doesn't have a domain provisioned yet. Re-confirm the correct project is selected (Step 5) and re-run `projects:get --json`; check `blocks-os doctor --json` for a blocking project-state issue. Only after that re-verification still comes back empty, ask the user for the app domain - state plainly that the CLI/project data couldn't identify one.

## Step 7 - App's public OIDC client (portal-only, separate from the CLI's own login in Step 2)

This is **your project's own OIDC client id** - a public browser client registered in the OS portal for this specific app's end-user login. It is unrelated to how the CLI itself authenticates (Step 2), and it is not a secret - never conflate the two or reuse one for the other.

State exactly what's needed: public client, callback `https://<domain>:5173/login/callback`, scope `openid profile`. Once the user registers it, have them give you the resulting client id (never a secret - a public client shouldn't have one).

**Stop condition:** if login is in scope for this build, do not proceed without this client. If the user only wants the app scaffolded without a working login yet, proceeding without it is allowed - ask which is wanted if unclear.

## Step 8 - Scaffold or resume

For an existing application, do not run `blocks-os new web`. Continue to Step 9 and perform only the incomplete commands identified during workspace inspection.

For a new application, scaffold from the confirmed workspace parent. Always pass `--blocks-api-url https://api.seliseblocks.com` explicitly - never omit it. If omitted, the CLI defaults it to the OS control-plane API (`os.seliseblocks.com`), not the runtime Data/IAM/Localization gateway the SDK actually needs, and the scaffolded app would be wired to the wrong service. If your project's OIDC client id exists (Step 7), include it as `--client-id`:

```bash
blocks-os new web <app-name> --x-blocks-key <x-blocks-key> \
  --app-domain <domain> --blocks-api-url https://api.seliseblocks.com \
  --client-id <your-project-oidc-client-id>
```

If scaffold-only (no project OIDC client id yet), omit `--client-id` - the app still scaffolds fine; its login page shows a setup notice until `VITE_BLOCKS_OIDC_CLIENT_ID` is filled in `.env` later:

```bash
blocks-os new web <app-name> --x-blocks-key <x-blocks-key> \
  --app-domain <domain> --blocks-api-url https://api.seliseblocks.com
```

## Step 9 - Work inside the generated app folder

Phase boundary: after `blocks-os new web <app-name>` succeeds, or after an existing app is confirmed, stop treating the task as global CLI setup. From this point forward, the application folder is the working project.

For a new application, enter the generated folder:

```bash
cd <app-name>
```

For an existing application, remain in the confirmed existing application path. Do not run `cd <app-name>` again.

Do not re-check the CLI version or reconfigure CLI auth after this boundary unless a command fails with an auth/config error. The agent's focus is now the generated application, not the global CLI setup.

For a new application, run these commands from the app folder. For an existing application, run only the commands that inspection showed are incomplete or required:

```bash
blocks-os init
npm install
npm install @seliseblocks/client@latest
npm run cert
```

Later Step 10 data commands (`blocks-os data:validate`, `blocks-os data:schema:push`, and `blocks-os data:reload`) must also run from this same app folder.

`blocks-os init` writes `blocks.json` and the `blocks/data/...` folders relative to the current directory - run it here, inside the scaffolded app folder, not before scaffolding. Every `data:*` command in Step 10 must be run from this same directory. The scaffold pins `@seliseblocks/client` to whatever was current at generation time - unlike the CLI check in Step 1, don't ask before this one; just install `@latest` and move on.

Then follow the generated README's instructions for trusting the certificate on the user's OS - don't hardcode OS-specific trust commands here, the scaffold's own README is the source of truth for that.

Before running the app, show the exact dev host value from `.env` / scaffold config and ask:

"The app will run at `https://<domain>:5173`. Have you added `<domain>` to your local hosts file so it resolves to `127.0.0.1`?"

- Yes -> continue.
- No/unsure -> pause and tell the user to follow the generated README's host-entry instructions first. Do not start the dev server until the host entry is confirmed.

Then: `npm run dev` - open `https://<domain>:5173` (never `http` or `localhost`).

## Step 10 - Schema

Use the entities, fields, and types established in Step 0. If they are still incomplete, ask one question at a time until the schema is unambiguous. Create that schema under the generated app's Blocks data schema folder before validating.

```bash
blocks-os data:validate --json
blocks-os data:schema:push --dry-run --json   # confirm, then:
blocks-os data:schema:push --yes --json
blocks-os data:reload --dry-run --json        # confirm, then:
blocks-os data:reload --yes --json
```

## Step 11 - Build the CRUD screen

`<entity>Api.ts` / `use<Entity>.ts` / `<Entity>Form.tsx` / `<Entity>Page.tsx` using `blocksClient.data.collection<Entity>("EntityName")`, reusing the scaffold's shared UI components and existing route guards.

## Step 12 - Test end to end

First run the available build, type-check, lint, and test commands from `package.json`. Then verify login when in scope, current user loading, and create/list/edit/delete for each requested entity. If a browser-automation tool is available, drive the test directly and read the result; otherwise, ask the user to test one record and report what happened.

## Step 13 - Optional: release

Only if requested:

```bash
blocks-os release:deploy --repo-id <repoId> --dry-run --json   # confirm, then:
blocks-os release:deploy --repo-id <repoId> --yes --json
```
