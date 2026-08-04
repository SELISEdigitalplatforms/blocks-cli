# Blocks CLI Guide for AI Agents

This guide is for AI agents using the published `@seliseblocks/cli-os` npm package. The installed binary is `blocks`.

Use `blocks` as the control plane. If a capability exists in the CLI, call the CLI from the terminal instead of calling Blocks cloud APIs directly from ad hoc scripts or generated application code.

## Install

Install the package in the environment where the agent will operate:

```bash
npm install -g @seliseblocks/cli-os
```

Verify the binary:

```bash
blocks --version
blocks --help
```

For local package development only, contributors may run `node bin/run.js ...` from the source repository. AI agents consuming the npm package should use `blocks ...`.

## Global Options

Namespaced commands accept either spaces or colons, e.g. `blocks data schema list` and
`blocks data:schema:list` are equivalent. Global options available on every command:

- `--json` - print machine-readable JSON where supported.
- `--api-url <url>` - override the Blocks API URL for this command.
- `--account <name>` - use a named account profile; default is implicit.
- `--project <tenantId>` - use a project tenant for project-scoped commands.
- `--dry-run` / `--yes` - see Operating Rules below.

## Operating Rules

- Use `blocks ...` for all supported Blocks OS, IAM, Data, Release, and scaffold operations.
- Prefer `--json` for automation and parsing.
- Use `--dry-run` before any mutating command.
- Do not run real mutating cloud commands unless the user explicitly approved the exact action.
- Never print, commit, scaffold, or document access tokens, refresh tokens, cookies, JWTs, or other secrets.
- Treat any secret pasted into chat or logs as exposed and rotate it before production use.
- Generated apps must not contain CLI tokens.
- If a CLI command returns an error, fix or report the CLI path. Do not bypass the CLI with a one-off API request when the command exists.

## Login

Device-code login uses the packaged OS client id. It prints a verification URL and user code, opens the browser to the verification page when possible, then polls until approved:

```bash
blocks login
```

Check current auth state:

```bash
blocks auth status --json
```

If local auth state is stale or corrupted (Windows profile change, machine migration, Keychain reset), clear local auth state and log in again:

```bash
blocks auth remove <account>
blocks login
```

Use `blocks logout` to revoke the current refresh token when possible and remove local session data. Use `blocks auth refresh --json` to force account token refresh, and `blocks auth refresh --project --json` after a project session already exists.

Run health checks without mutation:

```bash
blocks doctor --json
```

## Project Workflow

List projects:

```bash
blocks projects list --json
```

`projects create` is currently disabled in this build (commented out pending a product decision) - do not tell users it's available, and do not try to work around its absence with a raw API call. Projects must already exist (created from the Blocks portal) before selecting one below.

Select a project:

```bash
blocks use <projectTenantId>
```

Read the selected project:

```bash
blocks projects get --json
```

If an impersonated project token has expired or failed and re-running the command doesn't
recover, clear the selection and reselect to force re-impersonation:

```bash
blocks deselect
blocks use <projectTenantId>
```

## Scaffold a Web App

Generate a React/Vite Blocks app. All of `--x-blocks-key`, `--app-domain`, and `--client-id` are optional now - they're resolved from the selected project when omitted:

```bash
blocks use <projectTenantId>   # if not already selected
blocks new web <appName>
```

This is interactive when a value isn't already known: if the project has more than one registered domain you're prompted to choose; the OIDC client is offered as a pick-list of the project's existing clients, plus "create a new one now" (prompts only for display name + redirect URI, defaulting to `https://<appDomain>/login/callback`) or "skip, register later." Do not fabricate a client id or domain value yourself.

**An AI agent running this non-interactively will hang on these prompts** - there's no stdin to answer "Choose 1-3:" from an automated process. Before running `new web`, gather the values yourself and pass them explicitly:

```bash
blocks projects get --json                     # see the project's domain(s) under project.applications
blocks auth oidc-clients list --json           # see existing OIDC clients, if any
```

Then run with explicit flags so no prompt is reached:

```bash
blocks new web <appName> --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl> --client-id <publicOidcClientId>
```

`new web` also accepts `--blocks-api-url <url>` and `--oidc-url <url>`, same as `sdk client`
below. `--blocks-api-url` defaults to the OS control-plane API if omitted - pass the runtime
Data/IAM/Localization gateway URL explicitly (typically `https://api.seliseblocks.com`) for the
scaffolded app to work at runtime. `--oidc-url` defaults to `https://iam.seliseblocks.com`.

Validate the scaffold:

```bash
cd <appName>
npm install
npm run build
```

Do not pass CLI auth state to the scaffolded app. Browser apps must use a public OIDC client and the SDK hosted IdP flow: `blocksClient.auth.idp.redirectToProvider()` on login click and `blocksClient.auth.idp.callback()` on `/login/callback`.

`--app-domain` is the app's real Blocks domain/origin, for example `https://dbpdba.seliseblocks.com`. The generated `.env` keeps that full value as `VITE_BLOCKS_APP_DOMAIN` and derives the local dev host without a scheme as `VITE_BLOCKS_DEV_HOST=dbpdba.seliseblocks.com`.

For local browser login on the real host domain:

1. Add `127.0.0.1 <VITE_BLOCKS_DEV_HOST>` to the hosts file.
2. Run `npm install`.
3. Run `npm run cert`.
4. Run `npm run dev`.
5. Open `https://<VITE_BLOCKS_DEV_HOST>:5173`, not plain `http://`.

The generated cert script uses the `selfsigned` Node dependency, so it works from normal PowerShell after `npm install`; do not tell Windows users to switch to Git Bash just for OpenSSL. If hosted login or secure cookies fail locally, confirm the app is opened with the HTTPS dev URL from `VITE_BLOCKS_DEV_HOST`.

## SDK Client (read-only)

`sdk client` answers "I want to use the Blocks SDK - show me the client." It resolves this project's `@seliseblocks/client` config (same values `new web` scaffolds an app with) and prints a ready-to-paste `createBlocksClient(...)` snippet - **it never writes a file or mutates anything**. To scaffold a full app instead, use `new web` above.

```bash
blocks sdk client --x-blocks-key <projectTenantId> --app-domain <appDomainOrUrl> --client-id <publicOidcClientId> --blocks-api-url https://api.seliseblocks.com
```

As with `new web`, always pass `--blocks-api-url https://api.seliseblocks.com` explicitly - the default is the OS control-plane API, not the runtime gateway the SDK needs. Passing both `--app-domain` and `--client-id` skips the project lookup entirely, so it needs no CLI login at all - useful for a quick, non-interactive check. Omit either one and it resolves from the selected project instead (auto-picks when there's exactly one match, otherwise lists the options and asks you to pass the flag explicitly - it does not prompt or create anything, since this command is read-only). Use `--json` for the resolved values instead of the snippet.

## Skills

`skill list [--json]` / `skill show <name> [--json]` / `skill add <name> [--dir <path>]` read this package's bundled copy of `blocks-skills/*/SKILL.md` (the conversational agent-context docs referenced in `BLOCKS_AGENT_GUIDE.md`) - local-only, no cloud calls. `skill add` copies one skill's `SKILL.md` into `<dir>/<name>/SKILL.md` (default `./blocks-skills`) in the current directory, for pulling a single skill into a project outside this monorepo. As with any skill file, verify command names against this guide or `blocks --help` before running them - skills are conversational context, not command ground truth.

## IAM, MFA, and Auth Admin

`iam me` reads the CLI operator's own account identity (bootstrapping, not a project resource):

```bash
blocks iam me --json
```

Every other command below is project-scoped: it requires a project already selected (`blocks use <tenantId>`) and always calls IAM through an impersonated project token - never the account token, and never something you construct yourself. If no project is selected, the command fails with `project_not_selected`; run `blocks use <tenantId>` first (see Agent Failure Handling).

Command families (run `blocks --help` for the full flag reference on each):

- `iam users *`, `iam email available` - list/get/create/update/activate/deactivate, access grant/revoke, existence and email-availability checks.
- `iam roles *` - list/get/create/update, assign-permissions, assignable.
- `iam permissions *` - list/get/create/update, by-severity.
- `iam resources *` - resource groups and feature flags (read-only).
- `iam organizations *` - list/get/create/update, `my`, and organization config get/save.
- `iam signup-settings *` - get/save tenant signup policy.
- `mfa config *`, `mfa totp *`, `mfa generate`/`resend`/`verify`, `mfa method set`, `mfa disable`, `mfa backup-codes *` - tenant MFA policy plus enrollment/verification/backup-code flows.
- `mfa totp enable --mfa-type <n>` - composed TOTP enrollment: `totp setup` → prints the QR/secret → `totp verify-setup` → `method set` → `backup-codes generate`, one confirmation. Prefer this over running the individual steps. `--mfa-type` is required and not defaulted - the tenant-specific integer meaning "TOTP" isn't documented anywhere in this CLI; don't guess it, ask the user or check `mfa config get`. **Prompts interactively for the verification code unless `--code <c>` is given** - an agent running this non-interactively must supply `--code` (from wherever the user's authenticator app output is captured) or it will hang waiting on stdin. Deliberately excludes `mfa config save` (a separate tenant-wide admin policy, not part of one user's enrollment).
- `auth idp *` - identity provider (SSO/OIDC) configuration: list/get/create/update/delete/status.
- `auth config *` - AuthController tenant config (token lifetimes, lockout policy, etc.).
- `auth client-credentials *` - machine-to-machine client credentials: list/save/delete.
- `auth oidc-clients *` - OIDC client app registrations: list/get/save (upsert)/delete/rotate-secret.

Rules:

- Use `--dry-run` before any mutating command in these families, the same as Data/Localization/Release, then `--yes` only after explicit approval.
- Rich payloads (identity provider config, OIDC client config, user/role/permission create-update bodies, etc.) accept `--body '<json>'` or `--file <path.json>` on top of the documented convenience flags - use whichever is easier for the exact fields you need to set.
- `auth idp create`/`update`, `auth client-credentials save`, and `auth oidc-clients save`/`rotate-secret` can return a `client_secret` shown only once. Never print, log, commit, or otherwise persist it outside what the user explicitly asked to store; treat that response the same as any other CLI-managed secret.
- Do not add IAM/MFA/Auth admin behavior outside these supported CLI commands unless the CLI package is explicitly extended and tested.

## Data

Check the data-source configuration first. Most projects run on Blocks-managed storage by default, so this is usually the only `data config *` command you need:

```bash
blocks data config get --json
```

Only create/update a data source configuration after explicit user approval - it points the project's Data Gateway at a different (external) database, which is a deliberate, rare action:

```bash
blocks data config create --connection-string "<cs>" --database-name "<name>" --dry-run --json
blocks data config create --connection-string "<cs>" --database-name "<name>" --yes --json
blocks data config update --item-id <id> --connection-string "<cs>" --dry-run --json
blocks data config update --item-id <id> --connection-string "<cs>" --yes --json
```

Validate local files:

```bash
blocks data validate --json
```

List schemas:

```bash
blocks data schema list --json
```

Pull schemas:

```bash
blocks data schema pull --json
```

Push schemas only after dry-run and approval:

```bash
blocks data schema push --dry-run --json
blocks data schema push --yes --json
```

Pull rules:

```bash
blocks data rules pull --json
```

Deploy rules only after dry-run and approval:

```bash
blocks data rules deploy --dry-run --json
blocks data rules deploy --yes --json
```

Reload Data schema configuration only after approval:

```bash
blocks data reload --dry-run --json
blocks data reload --yes --json
```

**Prefer `data sync` over running validate/push/deploy/reload separately.** It composes all four (validate → `schema push` → `rules deploy` → `data reload`) behind one confirmation, and it's the only way to guarantee the reload actually happens - nothing else calls it automatically, so schema/rule changes pushed without a following `data reload` can sit staged without going live:

```bash
blocks data sync --dry-run --json
blocks data sync --yes --json
```

It validates first and hard-fails with no API calls made if schemas or the rules file don't parse/validate. It prints 3 separate step outputs (one per underlying command), not one combined JSON document - parse each block in sequence if you need machine-readable results from all three.

### Raw Data API

`validate`/`schema list`/`schema pull`/`schema push`/`rules pull`/`rules deploy`/`reload` above cover the common file-oriented workflow. The rest of `/data/v4/*` is exposed directly, project-scoped with an impersonated project token only. Run `blocks --help` for the full flag reference on each; command families:

- `data schema get`/`get-by-name`/`aggregation`/`change-logs`/`delete` - single-schema lookup by id or collection name, access-level aggregation summary, unadapted change logs (cleared by `data reload`), and irreversible delete.
- `data schema info list`/`save`/`update` + `data schema fields` - a two-step alternative to `schema push` (create/update schema metadata, then add/update field definitions separately). Prefer the file-oriented `schema push` workflow for normal authoring; use these only for a targeted metadata or field-only change without touching the local schema JSON.
- `data rules policy get`/`delete` - read or delete one data-access policy without a full `rules pull`/edit/`rules deploy` round-trip.
- `data validation list`/`get`/`by-schema`/`by-schema-field`/`save`/`delete` - field-level validation rules. No file-oriented workflow exists for these (no local JSON file to pull/push). `save` is an upsert (omit `--item-id` to create, pass it to update) and requires a `validations` array passed via `--body`/`--file` - there's no scalar flag for it, e.g. `--body '{"validations":[{"type":1,"value":"^[0-9]+$","isActive":true}]}'`.
- `data files *` - DMS/storage: `get`/`get-many`/`info` (read), `presigned-upload-url` + `upload-to-url` (cloud storage, two calls) or `upload-to-local-storage` (one call, local storage), `update-additional-info`, `delete`, `dms-list`/`dms-upload` (folder browsing / registering an uploaded file into a folder), `create-folder`/`delete-folder`.

Same rules as everywhere else: `--dry-run` before any mutating command, then `--yes` only after explicit approval.

**`--file` means two different things depending on the command.** Everywhere else in this CLI (`--body '<json>'`/`--file <path.json>`), `--file` is a JSON payload file read by `jsonBodyFlag`. On the `data files *` upload commands (`upload-to-url`, `upload-to-local-storage`), `--file` is instead the local binary file to read and upload - there is no JSON payload involved. Don't conflate the two: passing a JSON path to `data files upload-to-local-storage --file` uploads the JSON text as the file's bytes, it does not set a request body.

**Prefer the composed `data files upload` over the manual steps below.** It runs presign → PUT → dms-upload for you (or the one-call local-storage path with `--local-storage`), so the file is both stored and visible in DMS afterward - no copy-pasting `uploadUrl`/`fileId` between commands:

```bash
blocks data files upload --file ./invoice.pdf --access-modifier Public --dry-run --json
blocks data files upload --file ./invoice.pdf --access-modifier Public --yes --json
blocks data files upload --file ./invoice.pdf --local-storage --yes --json   # local-storage-backed projects
```

Manual cloud-storage upload, if you need the intermediate steps for some reason (two calls):

```bash
blocks data files presigned-upload-url --name invoice.pdf --access-modifier Public --json
# take the returned uploadUrl and fileId, then:
blocks data files upload-to-url --url "<uploadUrl>" --file ./invoice.pdf --content-type application/pdf --dry-run --json
blocks data files upload-to-url --url "<uploadUrl>" --file ./invoice.pdf --content-type application/pdf --yes --json
```

Manual local-storage upload (one call):

```bash
blocks data files upload-to-local-storage --file ./invoice.pdf --access-modifier Public --dry-run --json
blocks data files upload-to-local-storage --file ./invoice.pdf --access-modifier Public --yes --json
```

Either manual upload path only stores the bytes - it does not make the file appear in a DMS folder. Register it afterward if the user needs that (the composed `data files upload` above already does this step for you):

```bash
blocks data files dms-upload --file-storage-id <fileId> --artifact-name invoice.pdf --dry-run --json
blocks data files dms-upload --file-storage-id <fileId> --artifact-name invoice.pdf --yes --json
```

## Localization

Generate or update local i18n dictionaries as JSON, then let the CLI sync them to Blocks Localization. Do not ask humans to manually copy keys into the portal.

Default file convention:

```text
blocks/localization/<module>.<language>.json
```

Example:

```json
{
  "dashboard.title": "Dashboard",
  "products.empty": "No products found"
}
```

Nested JSON is accepted on input and flattened before validation:

```json
{
  "dashboard": {
    "title": "Dashboard"
  }
}
```

Validate first:

```bash
blocks localization validate --module common --language en --json
```

Push only after dry-run and approval:

```bash
blocks localization push --module common --language en --dry-run --json
blocks localization push --module common --language en --yes --json
```

Pull published cloud localization when local fallback files need to be refreshed:

```bash
blocks localization pull --module common --language en --json
```

Use Localization gateway v4 paths without `/api`: `/localization/v4/Module/Gets`, `/localization/v4/Module/Save`, `/localization/v4/Key/SaveKeys`, and `/localization/v4/Key/GetCloudUilmFile`.

### Raw Localization API

`validate`/`push`/`pull` above cover the common i18n file workflow. Every other `/localization/v4/*` endpoint is also exposed directly, project-scoped with an impersonated project token only (never the account token). Run `blocks --help` for the full flag reference on each; command families:

- `localization assistant translation-suggestion` - AI translation suggestion for a single string (`--source-text`, `--destination-language`, optional glossary/context flags).
- `localization config get-webhook`/`save-webhook` - tenant webhook config for localization change notifications.
- `localization glossary save`/`list`/`get`/`suggested`/`delete` - glossary term CRUD and AI-suggested glossary lookup.
- `localization key save`/`list`/`get-by-names`/`get`/`delete`/`delete-keys` - key CRUD and search beyond the bulk `push`/`pull` flow.
- `localization key get-timeline`/`get-localization-timeline`/`get-timeline-by-operation-id`/`rollback` - key/tenant change history and rollback.
- `localization key get-uilm-file`/`generate-uilm-file`/`uilm-import`/`uilm-export`/`get-uilm-exported-files`/`get-language-file-generation-history` - UILM language-file generation and import/export jobs.
- `localization key translate-all`/`translate-key`/`translate-keys` - trigger AI machine translation for a module or specific keys.
- `localization key translate-and-export --module-id <id> [--wait]` - composed: `translate-all` → `generate-uilm-file` → `uilm-export`. Prefer this over running the three by hand. `--wait` polls translation progress first via a self-generated correlation id (translation is async and has no documented "done" field, so this is a best-effort heuristic - it prints the raw response every poll); without `--wait` it just fires all three back to back like running them manually in sequence.
- `localization language save`/`list`/`list-for-tenant`/`delete`/`set-default` - tenant language catalog management.
- `localization module save`/`list`/`list-for-tenant`/`tag-glossary` - module CRUD and glossary tagging.

Same rules as everywhere else: `--dry-run` before any mutating command, then `--yes` only after explicit approval; rich payloads accept `--body '<json>'`/`--file <path.json>` on top of the documented convenience flags. `localization config save-webhook`'s `--secret` is redacted in `--dry-run` output only - treat the live response as a secret.

## Mail

Project-scoped SMTP/inbound mail configuration, templates, and mailbox reads via `/os/v4/Mail/*`:

```bash
blocks mail config list --json
blocks mail config get <name> --json
blocks mail config save --name <n> --host <h> --port <p> --enable-ssl \
  --sender-name <n> --sender-address <addr> --account-password <p> --dry-run --json
blocks mail config save --configuration-id <id> ... --yes --json   # update
blocks mail config delete <configurationId> --dry-run --json
blocks mail config duplicate <configurationId> --dry-run --json

blocks mail template list --configuration-id <id> --json
blocks mail template get <itemId> --json
blocks mail template save --configuration-id <id> --name <n> --language <l> \
  --subject <s> --template-body <html> --dry-run --json
blocks mail template delete <itemId> --dry-run --json
blocks mail template clone <itemId> --name <n> --dry-run --json

blocks mail mailbox list --configuration-id <id> --json
blocks mail mailbox get <messageId> --json
```

Treat `--account-password` as a secret; the CLI redacts it in `--dry-run` output but the live response is still yours to protect.

## Notification

Project-scoped notification channel configuration via `/os/v4/Notification/*`:

```bash
blocks notification list --json
blocks notification get <itemId> --json
blocks notification save --name <n> --channel <0|1> --type <0-3> --dry-run --json
blocks notification save --name <n> --channel <0|1> --type <0-3> --update --yes --json
blocks notification delete <itemId> --dry-run --json
```

`--channel` and `--type` are raw numeric enum values from the Blocks OS API (`NotifierTypes`, `NotificationReceiverTypes`) — the API does not publish names for them.

## Storage

Project-scoped storage backend configuration via `/os/v4/Storage/*`:

```bash
blocks storage config list --json
blocks storage config get <name> --json
blocks storage config save --name <n> --strategy <s> --secret-key <k> --access-key <k> --dry-run --json
blocks storage config save --item-id <id> --update ... --yes --json   # update
blocks storage config delete <name> --dry-run --json
```

`--secret-key`, `--access-key`, `--password`, and `--connection-string` are secrets; the CLI redacts them in `--dry-run` output only.

## Release

`release deploy` needs no `--repo-id` - it resolves the repo linked to the selected project (`Project/GetAsset`) and that repo's connected branch (`Build/repo-details`) on its own, and refuses to deploy if the connected branch doesn't match the project's environment name. Trigger a deploy only after dry-run and approval:

```bash
blocks release deploy --dry-run --json
blocks release deploy --yes --json
blocks release deploy --domain <customDomain> --yes --json   # also sets the custom deployment domain first
blocks release deploy --yes --wait --json                    # poll until the build finishes instead of returning the build id
```

If no repo is linked yet, the command fails with `repo_not_linked` - that requires GitHub OAuth, so it can only be done from the Blocks portal; do not attempt to link a repo from the CLI.

`--wait` polls `/release/v4/api/Build` (same data `release status` reads) every `--poll-interval` seconds (default 10) until a terminal-looking state is detected or `--timeout` elapses (default 900s). There's no documented status field/enum for this endpoint, so "terminal" is a best-effort text match (success/fail/complete/cancel/etc. anywhere in the response) - the raw JSON is printed every poll, so verify against that rather than trusting the heuristic blindly. Without `--wait`, `release deploy` returns immediately with just a build id, same as before.

Read build status:

```bash
blocks release status <buildId> --json
blocks release builds get <buildId> --json
```

List builds for a repository (repoId is optional now - omit it to resolve from the selected project's linked repo assets, auto-picked if there's exactly one, otherwise interactively prompted, which will hang a non-interactive agent - pass `--repo-id` explicitly if you don't already know there's exactly one):

```bash
blocks release builds list --repo-id <repoId> --json
```

## Agent Failure Handling

- `not_logged_in`: run `blocks login`, then `blocks projects list`, then `blocks use <tenantId>`.
- `refresh_token_rejected`: run `blocks login`.
- `refresh_network_error`: check the network and configured OIDC URL, then retry.
- `auth_repair_required`: inspect `blocks auth status --json`; if local storage is unreadable or stale, run `blocks auth remove <account>`, then `blocks auth status --json` and `blocks login`.
- `project_not_selected`: run `blocks projects list`, then `blocks use <projectTenantId>`.
- `api_auth_failed`: run `blocks auth status --json`, then login again. If the failure is specifically a stale/expired impersonated project token rather than the account token, `blocks deselect` followed by `blocks use <tenantId>` re-impersonates without a full re-login.
- `repo_not_linked` (from `release deploy`): no repo is linked to this project. This needs GitHub OAuth - tell the user to link it from the Blocks portal, do not retry from the CLI.
- `repo_ambiguous` (from `release deploy`): multiple repos are linked and none is named for the current environment. Tell the user to check the project's repo links in the portal.
- `repo_not_found` (from `release deploy`): the linked asset's repo id doesn't exist in blocks-release. Tell the user to check the project's repo link in the portal.
- `branch_environment_mismatch` (from `release deploy`): the connected repo's branch doesn't match this environment's name. The message states the branch found and the environment required - do not retry; the repo's connected branch must be fixed first.
- `build_wait_timeout` (from `release deploy --wait`): the build didn't reach a detected terminal state within `--timeout`. The deploy itself already succeeded (this only affects the wait) - check manually with `release status <buildId>` rather than assuming failure.
- `translation_wait_timeout` (from `localization key translate-and-export --wait`): translation didn't settle within `--timeout`. Check manually with `localization key get-timeline-by-operation-id <operationId>` (the id is printed before the wait starts), then run `generate-uilm-file`/`uilm-export` yourself once ready rather than assuming translation failed.
- `no_project_domain` (from `new web`): the project has no domains registered in Blocks. Add one from the portal, or pass `--app-domain` explicitly if the user already knows the intended value.
- HTML returned from an API command means the command endpoint path is wrong and must be fixed in the CLI.

## Local Development Checks

These are for contributors maintaining the package, not for normal AI package consumers:

```bash
npm test
npm pack --dry-run
```

Live smoke checks after login:

```bash
blocks projects list --json
blocks iam me --json
blocks data schema list --json
```

## Security Boundary

The CLI may store secrets and tokens in the OS credential backend. Generated apps must not. The scaffolded app should receive only public runtime config such as API URL, project key, app domain, OIDC URL, and public OIDC client id.
