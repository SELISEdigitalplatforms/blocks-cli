# Changelog

## 0.11.0

### Added

- **`blocks logic function *` -- Blocks Functions from the terminal.** blocks-logic
  now runs tenant-written Node 24 functions, and the CLI had no way to reach them,
  so writing one meant the Studio editor. Twenty commands cover the whole
  lifecycle against `/logic/v4/Functions/*`:
  - `list`, `get`, `create` (from the `Minimal`/`HttpEcho`/`FetchTransform`/
    `ReusedConnection` starters), `update` (name/description), `delete`
    (`--force` past `FUNCTION_DELETE_BLOCKED` when workflow steps still use it).
  - `export <id> --dir` writes `index.js`, `package.json`, `package-lock.json`
    and a `function.json` of settings; `save <id> --dir` reads the same layout
    back. Functions/Save replaces the whole working copy, so `save` reads the
    stored function first and only what is supplied changes -- source files,
    `function.json`, and flags for HTTP methods, Public/Token access, roles and
    permissions, sync/async response, the rate limit, install scripts and
    variables (`--var KEY=VALUE`, `--unset-var`).
  - `test` runs the saved code without deploying; `deploy` ships it, and when the
    image is still building it watches the build and deploys exactly that one
    (`--no-wait` / `--build-id` to split the two steps).
  - `url` prints the public invoke URL with the `x-blocks-key`, methods, auth and
    response mode a caller needs -- skills may not cite raw gateway paths, so
    this is how an agent hands a webhook provider the address.
  - `runs`, `run`, `logs`, `replay`, `cancel`, `versions`, `source`, `build`,
    `audit`, `limits` for debugging and history.
  - The management API answers errors as `{ isSuccess:false, errors }` with the
    meaning in the status code; these come back as `FUNCTION_NOT_FOUND`,
    `FUNCTION_VALIDATION`, `FUNCTION_FORBIDDEN_CONTENT` (a typed credential --
    use `{{secret.<id>}}`), `FUNCTION_BUILD_FAILED` (with the build id to read),
    `FUNCTION_DELETE_BLOCKED`, `FUNCTION_RATE_LIMITED`, `FUNCTION_UNAVAILABLE`.
- **`blocks logic proxy openapi-preview`** reports the routes an OpenAPI 3
  document (`--spec-file` or `--spec-url`) would produce, flagging ones a proxy
  already has (`--proxy-id`). Read-only; the chosen operations go into a
  create/update `--file`.
- **`--requests-per-minute` and `--timeout-seconds` on `logic proxy create|update`**
  for the proxy-wide rate limit (P-3) and upstream timeout.
- **`blocks pull` writes `blocks/logic/functions.json`** (summaries; source comes
  from `logic function export`).
- `blocks new web` scaffolds pin `@seliseblocks/client` `^0.3.0`, the release that
  adds `blocks.logic` (functions and proxies). Publish the client before this CLI.

### Fixed

- **`logic proxy update` no longer wipes a proxy's rate limit and resilience
  settings.** Proxies gained `resilience` (timeout/retry/circuit breaker) and
  `requestsPerMinute`, and PUT resets either one when it is left out. The update
  carried over a fixed list of fields that predated both, so `--name` alone
  silently removed a proxy's retry policy and rate limit. Both are carried now,
  and a `--timeout-seconds` change keeps the stored retry and breaker.
- **`logic proxy update` can no longer overwrite someone else's change.** It now
  sends the `expectedVersion` it read; a proxy changed in between is refused
  with `PROXY_VERSION_CONFLICT` (409) instead of being clobbered. The 409 body
  only reaches the CLI as its message, so it is recognised from that too.
- **`logic proxy` and `logic scheduler` flags are no longer reported as
  ignored.** The command catalog only saw flags read in a command's own file, and
  these commands read theirs through `lib/` helpers, so `logic proxy create
  --name …` printed "--name … is ignored" while using it -- and under
  `BLOCKS_STRICT_FLAGS=1` refused to run at all. The catalog generator now maps
  those helpers to the flags they read.
- **`notifier notify` says why a project send fails, and builds a valid request**
  (blocks-site 95737817). blocks-logic looks `configurationName` up in the root
  tenant for an impersonated caller -- which every project-scoped CLI call is --
  so a project's own configuration comes back `no_configuration_exist`. That is a
  server-side fix; until then the CLI checks the project's configurations and
  stops with `notify_impersonation_unsupported` (send from the app with the SDK)
  instead of claiming the configuration does not exist. Since blocks-logic
  2026-10-24 a send also needs `blocks-logic::notifier::send` (401 otherwise),
  reported as `permission_required`. `--configuration-name` defaults to the
  project's configuration when it has exactly one (the dry-run says so);
  `connectionId`, `responseKey` and `responseValue`, which the service requires
  but a server-side send has no use for, default to `server`/`notification`/
  `notification`; a missing target or payload is refused before sending; and
  `--organization-ids` is added. An unknown name is
  `notification_configuration_not_found`.
- **`iam email available` answers for the selected project** (blocks-site
  3b86fd8d). It used to be an anonymous endpoint, answered for the tenant in
  `x-blocks-key` -- the root tenant on an impersonated call -- so it checked
  platform accounts. IAM now protects it with `blocks-iam::iam::email-available`
  and validates the token, so the project session answers for the project; a
  role without the permission gets `permission_required`. It and
  `iam users exists` also use IAM's POST forms; the deprecated GETs put the
  address in the URL.
- **`iam users activate` requires `--reason`** (blocks-site bacbaebd). IAM's
  activate request requires it, so leaving it out was always a 400; it is now
  refused locally with `reason_required`.
- **`iam users list --organization-id` filters by organization** (blocks-site
  1fc467dd). The CLI sent `organizationId`, but IAM's filter binds
  `organizationIds` (a list), so every user in the project came back. It takes a
  CSV now, and a `--body` filter's singular `organizationId` is translated.
- **`iam organizations list` and `notification list` start at the first page**
  (blocks-site 1fc467dd, 95737817). Both services page from 0 and the CLI sent
  its 1-based `--page` unchanged, so the default page skipped the first results.
  `organizations list` also sent `--ids` as one comma-joined value (one id
  server-side), and IAM refuses `--is-disabled`/`--ids`/`--parent-organization-id`
  without a search term ("The Search field is required"); without `--search` the
  CLI now reads all organizations and applies those filters itself.
- **Enabling OIDC points account-action links at the IAM host** (blocks-site
  8daf76c6). `auth config save --oidc-enabled` kept a project's preset
  `accountActionBaseUrl` -- its app domain -- and `new web` did too, so before an
  app was deployed the first user's activation link 404'd; with no stored value,
  `auth config save` refused to run at all. Under OIDC the links land on IAM's
  hosted `oidc/activate/` page, so both now use the account's IAM host (IAM pins
  it there on save too). `auth config save` checks that the page answers and
  warns on stderr when it does not (skip with `BLOCKS_NO_LINK_CHECK=1`).

### Changed

- `iam permissions create|update` take `--type 0-2` (DataProtection is gone).
  The client's switch-organization and validation-error fixes ship in client
  0.3.0 (see its CHANGELOG).
- `storage config list|get` show each secret as a status only
  (`<field>Status: none|active|locked|archived|missing|unavailable`): blocks-os now
  keeps storage credentials in SecretStore and never returns a value. Secret-named
  fields are still redacted, in case an older blocks-os echoes them back.
- `auth oidc-clients list|get` and `auth idp list|get` help no longer says the
  secret comes back on reads: IAM returns it once, on create, and
  `oidc-clients rotate-secret` gives a new one. Output is still redacted.

## 0.10.0

### Added

- **Every app gets the same `blocks/` tree, with a folder per service.**
  `blocks init` used to create only `blocks/data/`, and `blocks new web` only
  `blocks/localization/`. So an app's layout depended on which command made it,
  and nothing pointed agents at the other services. Both commands now write
  the same tree:
  - `data/` (with `schemas/` and `rules.json`), `localization/` and `workflows/`,
    which work as before;
  - new `iam/`, `auth/`, `mail/`, `storage/`, `release/` and `logic/` folders.

  Each folder has a README saying what belongs in it and which commands change
  it. `init` still never overwrites an existing file, and now also records
  `localization.dictionaries` in `blocks.json`.

- **`blocks pull` writes a read-only snapshot of the project's setup** into
  those six folders: roles, permissions, resource groups and features; auth
  config, OIDC clients and identity providers; mail configs and templates;
  storage configs; release repos; proxies and schedules. Agents can read the
  project's setup from files instead of making a dozen list calls.
  - **Source stamp:** each file wraps its data in a `_meta` block (`tenantId`,
    `pulledAt`, `cliVersion`, `readOnly`, `secretsRedacted`, `service`), so a
    stale or other-project snapshot is visible.
  - **Secrets:** redacted to `***` unless `--include-secrets` is passed. That
    covers the shared secret-field list plus `secretKey`, `sftpSecretKey` and
    the raw proxy `upstream`; `Storage/Gets` returns the raw storage entity,
    credentials included.
  - **Tenant check:** a `--project` that isn't the workspace's own is refused
    unless `--force`.
  - **Partial failure:** one failing service is reported under `failed` with a
    non-zero exit, while the rest are still written.
  - **Location:** files are written next to `blocks.json`, even when `pull`
    runs from a subdirectory. `--only iam,auth` pulls a subset.

  The snapshots are not a way to change anything: editing them does nothing,
  and changes still go through each service's own commands.

## 0.9.2

### Fixed

- **`new web` no longer rejects every OIDC client.** The 0.9.1 check that
  `--client-id` exists read the client list from `data`/`items`/`results`.
  IAM returns it under `oIDCClientCredentials`, so the CLI always saw an empty
  list. Every id was refused with `oidc_client_not_found`, even one just
  created, and the interactive picker never offered existing clients. `new
  web` now uses the same list parser as the deploy-time callback check. The
  test fixture now uses IAM's real response shape; the old bare-array fixture
  is what hid this.

- **`release deploy` and `release setup` now use the documented
  environment-to-branch mapping.** They assumed each environment deploys from
  a branch with the same name. That holds for `dev`, `test`, `stg`, `iat`,
  `uat`, `prod-shadow` and `pre-prod`, but Production (`prod`) deploys from
  `main`. So a correctly linked Production repo was refused with
  `branch_environment_mismatch`, and auto-resolving the repo for `prod` found
  nothing. Both commands now follow the mapping from the Project Settings docs
  and blocks-release (`main` → `prod`). The mismatch error also names the
  branch the environment expects.

## 0.9.1

### Changed

- **New data schemas are no longer made Public.** `data schema push`, `data
  schema info save` and `data sync` used to grant Public access (anonymous
  read, write, edit and delete) to every schema they created. The only trace
  was a `grantedPublicAccess` field in the output: help and the skill never
  mentioned it. And because `rules.json` security entries needed a schema id
  that didn't exist yet, the first `data sync` could not lock a new schema
  down, so new collections stayed open to anonymous writes until a second
  `rules deploy`. New schemas now keep the server default, **User** (signed-in
  users only). Pass `--access public` to get the old behaviour; an app that
  reads or writes a new collection anonymously needs this flag or a `security`
  entry. Existing schemas are never touched. The output reports the level as
  `newSchemaAccess`, and still includes `grantedPublicAccess` when Public was
  granted.
- **`localization push` regenerates the UILM file once per push, not once per
  key.** Every key used to be saved with `shouldPublish: true`, which makes the
  localization worker queue one UILM regeneration per key: a few-hundred-key
  push flooded the queue (~15/min) and blocked every other module's publish
  behind it for tens of minutes. `push` now saves keys unpublished and
  regenerates the touched module a single time. The new `--publish` flag
  controls this: `once` (default) saves then regenerates once; `per-key`
  restores the old behaviour (one regeneration per key); `none` saves without
  regenerating, for when you will run `localization key generate-uilm-file`
  yourself after several pushes. `--dry-run` reports the chosen mode and whether
  a regeneration will run.

### Added

- `rules.json` `security` entries can target a schema by `schemaName`, which
  is resolved in the destination project the same way policies are. One
  `data sync` can now create a schema and set its access with no window in
  between. A raw `schemaId` still works.
- `data rules deploy` (including `--dry-run`), `data validate` and `data sync`
  check security entries before anything is sent: a target is set, `operation`
  is 0-3, `policyType` and `accessLevel` are valid, and column-level entries
  have `fieldNames`. Operation 4 (ALL) is rejected, because the service ignores
  it and would report success without changing anything. A deploy now looks
  up every target schema first and fails before writing anything if one is
  missing. Previously it could fail halfway, after the security entries had
  already been applied.

### Fixed

- Two agents (or terminals) working in different project directories no longer
  retarget each other. The project selection lived in one account-wide slot in
  the global config, and `blocks use` only wrote `blocks.json` when the
  directory already had one -- so after `blocks use A` in project A and
  `blocks use B` in project B, every command in A (and in any subdirectory of a
  workspace, where `blocks.json` wasn't found) resolved to B and pushed there.
  `blocks use` now pins the tenant into the workspace's `blocks.json` (the
  nearest one at or above the working directory, created in the working
  directory if there is none; never in the home directory), project resolution
  walks up to that file, and a workspace without a tenant of its own fails with
  `project_not_selected` instead of borrowing the account selection. `blocks
  login` re-selects the workspace's project rather than the account's. The
  account selection still applies outside any workspace.
- `logic workflow import` and `logic workflow save` (create) no longer fail
  with a 500 ("Cannot deserialize the current JSON object ... into type
  'MongoDB.Bson.BsonDocument'") for every workflow that has node parameters --
  which is every real workflow, including the skill's own minimal webhook
  example. `Workflow/Create` binds nodes through a path that cannot read a
  node's `parameters` object, while `Workflow/Update` reads them correctly, so
  a create now sends an empty Create (name, description, settings) and then an
  Update with the nodes and edges. If the Update fails, the empty workflow is
  deleted so nothing half-created is left behind. Updating an existing
  workflow is unchanged (one PUT), and `save --dry-run` shows both requests.
- `new web --dry-run` no longer scaffolds the app or changes the tenant. The
  command had no dry-run handling, and `confirmMutation` treated `--dry-run`
  as approval. So a "preview" wrote the whole app to disk, switched
  `isOidcEnabled` on in the tenant's AuthController config (rewriting
  `accountActivationPath` along with it), updated the project selection, and
  printed `"created": true` -- an unapproved cloud change that agents made
  while trying to preview. `--dry-run` now only reads, and returns a plan: the
  target directory and whether it exists, the AuthController fields that would
  change (old and new values), the OIDC client, and the selection and
  `blocks.json` updates.
- `new web --client-id` must name one of the project's OIDC clients. A
  placeholder or typo was written into `.env`, and OIDC login was still
  enabled for a client that didn't exist. It now fails with
  `oidc_client_not_found`, listing the real clients, before anything is
  written.
- Project commands can no longer run as another tenant. The CLI stored each
  project session under the tenant it asked for, and never checked which
  tenant the issued token was actually for. Services take the caller's tenant
  from the token's `tenant_id` claim, so a token for another tenant silently
  answered from that tenant's data, with exit 0. For example,
  `localization module list` returned another project's (or the root
  tenant's) modules, and `localization push --dry-run` couldn't find the
  project's module and planned to create every key. IAM could return such a
  token from an impersonated refresh (fixed on the IAM side in `d79bb65b`).
  Once stored, it was used until it expired: `--project` made no difference,
  and the problem survived `blocks use`. Every project token, whether cached,
  refreshed or newly obtained by impersonating, is now checked against the
  requested tenant. On a mismatch the token is discarded and a fresh
  impersonation is tried once. If that fails too, the command stops with
  `project_token_tenant_mismatch` and nothing is sent with the wrong token.
- `confirmMutation` now refuses under `--dry-run` (`dry_run_would_mutate`),
  instead of treating `--dry-run` as approval. Any command that reaches a
  mutation during a preview now stops loudly rather than applying it.
  `git disconnect` was the only other command that reached this point, and
  now has a dry-run of its own.

## 0.9.0

### Added

- `blocks logic proxy list|create|get|update|enable|disable|delete` — Phase 1
  Proxies lifecycle against `/logic/v4/Proxies` (simple flags or `--file` for
  nested config; update uses read-merge-write so partial Mode A edits do not
  wipe routes/headers/access).
- `blocks logic proxy versions|revert|test|executions|execution|overview` —
  Phase 2 history, controlled revert, non-mutating test, and request-log/metrics
  reads against `/logic/v4/Proxies/*`.
- `blocks logic scheduler create|update|delete|list` — cron-triggered webhook
  schedules against `/logic/v4/Scheduler/*` (read-merge-write updates; secrets never echoed).
- `blocks data schema indexes list|create|delete` — schema index management
  against `/data/v4/schemas/indexes`, for the Data Gateway's GeoJson field type.
  A non-array GeoJson field on an Entity schema now gets a MongoDB `2dsphere`
  index automatically, and the server reports it separately from user indexes as
  `systemIndexes` (ids `system:<field>_2dsphere`). `list` shows both and says why
  the system ones are read-only; `create` takes `--fields name[:asc|desc],...`,
  `--name`, `--unique` (1-10 distinct scalar fields, max 15 user indexes) and
  explains a `FIELD_NOT_INDEXABLE` rejection on a GeoJson field, whose index is
  automatic and never manual; `delete` refuses `system:*` ids locally, since the
  server could only answer `INDEX_NOT_FOUND`. Writes reload the gateway like every
  other data mutation.

### Fixed

- Field types are case-sensitive on the server (`String`, `Int`, `Float`,
  `Boolean`, `DateTime`, `ID`, `GeoJson`, or another schema's name), but nothing
  said so, and the `data schema fields` help example used `"type":"string"`,
  which the server rejects as `Field_Type_Is_Not_Valid`. `data validate`,
  `data schema push` and `data schema fields` now refuse a miscased scalar
  (`string`, `GeoJSON`, `geojson`) locally and name the right spelling; the help
  example and the data-gateway skills are corrected.

All notable changes to `@seliseblocks/cli-os`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions before 0.3.0 were released without a changelog; their history is in the
repository's git log.

## 0.8.0

Adds a `logic workflow` command group so the Workflow service (blocks-logic) can be
managed from the CLI, and so agents can author workflows as JSON and load them into
a project.

### Added

- `logic workflow list`, `logic workflow get`, `logic workflow save`,
  `logic workflow delete`: CRUD for the workflows in the selected project. `save` is
  the low-level create/update from a JSON payload (`--file`/`--body`; `--item-id`
  switches Create to Update).
- `logic workflow import`: turn an exported workflow file into a live workflow. It
  validates the graph, assigns fresh node ids, rewrites edges, and re-points
  tenant-scoped keys (dataAction/dataGateway/sendMail `projectKey`, sendMail
  `EmailTemplate`) at the destination project -- the same normalization the portal's
  import does server-side. It upserts by name (never trusting the file's own id,
  like `data schema push`), optionally publishes with `--publish`, and warns about
  dropped nodes/edges and any `__REDACTED__` secret placeholders that must be filled
  before the workflow will run.
- `logic workflow export`: export one workflow (by id) or all (`--all`) to portable
  JSON that `logic workflow import` can consume. Secrets in node parameters (client
  secrets, the `x-blocks-key` header) are stripped to `__REDACTED__` by default;
  `--include-secrets` writes them verbatim (with a warning), since a workflow export
  embeds them in cleartext.
- `logic workflow publish` / `logic workflow unpublish`: activate or deactivate a
  workflow. A created or imported workflow is inactive until published; publishing
  registers its webhook and schedule triggers.

## 0.7.0

Brings the CLI back in line with the service changes shipped since 0.6.0 (blocks-os
mail and storage configuration, blocks-data upload security, blocks-iam password
policy and organization settings).

### Fixed

- `storage config save --update` no longer reports success for a change it never
  made. blocks-os now fixes a configuration's provider and credentials at create and
  drops them from every later save, still answering success, so the documented
  "rotate the access key with `--update --access-key`" silently did nothing. The CLI
  now refuses provider and credential flags on an existing configuration and says
  to delete and re-create. The four upload settings an update *can* change are
  replaced wholesale by the server, so the command reads the stored record and
  carries the ones not passed. A create whose `--name` is already taken, which the
  server would quietly turn into an update, is refused on the live run with the
  `--update --item-id` to use instead.

- `iam organizations config save` no longer switches org creation off for every
  channel it wasn't told about. The server assigns the four `allowOrgCreationFrom*`
  booleans straight from the request, so `--multi-org-enabled true` alone stored all
  four as false. The command now reads the current policy and merges over it.

- `data files upload` no longer leaves a file stuck in quarantine. When the storage
  configuration requires upload completion for the file's access modifier,
  blocks-data now holds the bytes privately until `files/complete-upload` verifies
  them, and the old two-step flow produced a file that was listed but unreadable.
  The command now declares size, content type and a SHA-256 checksum up front
  (an oversized file is refused before a URL is issued), sends the headers the
  presign response names instead of a hardcoded Azure pair, completes the upload
  when required, and fails with the server's `rejectionReason` if verification
  rejects it.

- `scripts/verify-endpoints.mjs` checks calls typed with a nested generic
  (`blocksRequest<Record<string, unknown>>(...)`). Its pattern stopped at the inner
  `>`, so seven route+verb pairs were never verified; all of them match.

### Added

- `mail config save` supports the new SMTP Office 365 provider (outbound-only,
  OAuth client credentials): `--entra-tenant-id` (the Microsoft Entra tenant, named
  so it is not mistaken for the Blocks one), `--client-id`, `--client-secret` (stored
  in Blocks Secrets, never returned, kept when omitted on an update) and
  `--mailbox-address`. `--provider` takes `amazon-ses`, `zoho` or `office365-smtp` as
  well as the raw number, and `--security-mode` takes `legacy`, `none`, `starttls` or
  `ssl-on-connect`. Updates carry the new fields from the stored record.
- `mail config duplicate --client-secret`: an Office 365 copy needs its own secret.
- `data files complete-upload <fileId> <fileVersionId>` for the manual cloud upload
  path, and `--size-in-bytes`, `--content-type`, `--checksum`, `--checksum-algorithm`
  on `data files presigned-upload-url`.
- `--object-access-level Creator|Organization` and `--inherits-parent-access` on
  `data files upload`, `presigned-upload-url` and `upload-to-local-storage`.
- `storage config save --upload-url-expiry-seconds`, `--download-url-expiry-seconds`,
  `--max-file-size-bytes` and `--upload-completion-required-for Public,Private`.
- `data config update --enable-analytics` (the first enable opens blocks-data's
  14-day analytics window).
- `auth config save` structured password policy flags: `--password-policy-min-length`,
  `--password-policy-max-length`, `--password-policy-require-uppercase|lowercase|numbers|special-chars`,
  `--password-policy-message`, and `--password-strength-message`.
- `iam organizations config save --org-name-uniqueness`.

## 0.6.0

### Fixed

- A JSON payload the shell mangled is now reported as a shell problem. PowerShell
  removes the inner double quotes when it hands an argument to a native executable,
  so the documented `--body '{"validations":[...]}'` reached the CLI as
  `{validations:[...]}` and failed with a JSON parse error pointing at the JSON --
  the wrong layer to go and fix. The retry with escaped quotes split the argument
  into three tokens, and the `--file` fallback then died on the BOM that
  PowerShell's `Out-File -Encoding utf8` writes, whose error message contains an
  invisible character. All three now resolve: a BOM is stripped before parsing, and
  a quote-stripped (PowerShell) or quote-wrapped (cmd.exe) payload fails as
  `json_payload_shell_mangled` naming the shell, the working escaped form, and the
  `--file` route that needs no quoting anywhere. bash and zsh were never affected
  and are unchanged. Applies to every command that takes `--body`/`--file`.

- `data validation save` no longer fails as a duplicate on the second save of a
  field. Its create endpoint refuses a second record for the same schema+field and
  answers HTTP 200 with `isSuccess: false` ("Validation already exists for this
  schema field"), so the documented "upsert" was really create-or-fail: the caller
  had to run `by-schema-field` themselves and retry with `--item-id`. The command
  now looks the field up and updates the record already there. `--item-id` still
  works and still wins. Because the endpoint replaces the whole rule list, the
  dry-run reports `target` (`create`/`update`) and `replacesExistingRules`.

- A failing Data Gateway reload no longer fails the command that wrote. The write
  has already been applied at that point, and reporting the whole mutation as failed
  invited a re-run -- which for `data validation save` came back as "Validation
  already exists", and for schema/rules writes re-sent a mutation that had landed.
  The write is now authoritative: `gatewayReload` reports `ok: false` with
  `writeApplied: true` and the `blocks data reload --yes` that finishes the job,
  and a stderr warning says not to repeat the write.

### Added

- `data validation save` builds a single rule from scalar flags, so the common case
  needs no hand-written JSON at all: `--type`, `--value`, `--secondary-value`,
  `--error-message`, `--is-active`. `validations` was the only payload field in the
  CLI with no scalar equivalent, which made inline JSON mandatory on this one command
  and nowhere else. `--type` takes a name (`regex`, `minlength`, `greater-than-or-equal`,
  ...; case and hyphens ignored) as well as the raw enum number -- the API publishes no
  named constants for `ValidationType`, so a number written from memory stored a
  different rule than the one asked for with no error. A length or comparison bound is
  sent as a number, matching how the server reads it back.

## 0.5.0

### Fixed

- A refresh token the identity provider rejects is now removed from the token
  store immediately. It used to stay there indistinguishable from a live one,
  so `blocks auth status` kept saying `available`, every command kept failing
  with `refresh_token_rejected`, and Studio -- which reads that status to decide
  whether to start a device login -- never started one. The access token is
  kept (it reports `expired` on its own).

- A generated app running inside blocks-studio's preview can be handed a
  refresh again. The preview keeps its session in an httpOnly cookie the page
  cannot read, and the host has no way to reach the auth module's variables,
  so `getRefreshToken()` now falls back to `sessionStorage` for a marker the
  host seeds there. The app itself still never writes a refresh token to
  storage -- it stays in memory -- and sign-out clears the key either way.

### Added

- `blocks git` -- source control for the project's own code, through the GitHub
  account connected in the Blocks portal: `status`, `init` (create the repo,
  commit, push, bind), `clone`, `connect <owner/name> --strategy
  keep-local|adopt-remote|merge`, `pull`, `push`, `disconnect`. The push
  credential is fetched from blocks-release (`Github/credential`) per command
  and handed to git through `GIT_ASKPASS` for that one process only; it is
  never written to `.git/config`, a remote URL or `blocks.json`. The binding
  lives in `blocks.json` as `repo: { provider, fullName, url, branch }`.
  `connect` refuses to guess which history wins (`strategy_required`); `pull`
  refuses a dirty tree (`working_tree_dirty`) instead of stashing. Studio's
  sandbox runs `blocks git push --yes` after each successful build.

## 0.4.3

### Fixed

- `localization push` no longer wipes every other culture. `Key/SaveKeys` ends in
  `repoKey.Resources = key.Resources` -- the request's resource list replaces the
  stored one -- and push sent only the culture being pushed, so pushing en-US,
  de-DE, fr-FR and it-IT into one module in sequence left all 27 keys holding
  it-IT alone and the app rendered `[ KEY MISSING ]` for every string. Push now
  reads the module's keys back (`Key/GetsByKeyNames`) and upserts one culture per
  key, carrying itemId, routes, glossary ids, context and the partially-translated
  flag so none of those are defaulted away either. `--dry-run` resolves the module
  read-only (it can no longer be the call that creates it) and reports
  `created`/`updated` counts plus the merged request.
- Localization list page numbers are sent zero-based. `Key/Gets`, `Glossary/Gets`,
  `Key/GetUilmExportedFiles` and `Key/GetLanguageFileGenerationHistory` skip
  `PageNumber * PageSize`, so the CLI's 1-based default skipped a whole page:
  `key list --page-size 100` against 27 keys answered `totalCount: 27` with an
  empty `keys` array, and `--page-size 20` returned only the last 7. The flag
  stays 1-based (`zeroBasedPageNumber`, next to the existing `zeroBasedPage` for
  `--page`); the timeline endpoints, which are genuinely 1-based, are untouched.
- `key generate-uilm-file --module-id <id>` works without `--guid`. The server's
  `GenerateUilmRequest.Guid` is non-nullable, so omitting it failed binding with
  `Guid: The Guid field is required.` while `--guid` alone failed the CLI's own
  `--module-id` check. The generator never reads the value -- it is only carried
  onto the queued event -- so it now defaults to the module id, which also
  repairs `key translate-and-export`, whose generate step passed no guid at all.
- `key save` publishes by default. `Key/Save` queues the UILM regeneration only
  when `ShouldPublish` is true, and the runtime reads that generated file rather
  than the keys -- so a save without `--should-publish` stored the translation and
  left every reader on the previous file. It now sends `shouldPublish: true`
  unless `--should-publish=false` is passed, matching push.
- `key save --item-id <id>` no longer demands `--key-name` and `--module-id` as
  well. `Key/Save` upserts by keyName + moduleId, so both are still required in
  the request; the CLI now reads them from `Key/Get` when only the id is known.
- The command catalog knows the flags read by `zeroBasedPage`/`zeroBasedPageNumber`.
  Catalog analysis stops at `lib/`, so `--page` was missing from every IAM list
  command and `blocks` warned about it as an unknown flag on valid usage.

## 0.4.2

### Fixed

- `auth oidc-clients save --item-id` actually merges now. The GET wraps the
  client in an envelope (`{ isSuccess, oIDCClientCredential: {...} }`); the
  save spread the envelope, so none of the stored fields carried and a
  uris-only re-save reset `isAutoRedirect`, `requirePkce` and the rest to the
  DTO defaults -- while echoing the envelope (stored `clientSecret` included)
  back at the API. The client is now unwrapped and only the save DTO's fields
  are carried, so `--redirect-uris` alone is a safe edit and the secret never
  travels. Confirmed against a live project where a re-save had flipped
  `--auto-redirect` off.

### Added

- `release setup`, `release deploy` and `release domain set` now close the
  fresh-deployment login gap: `setup` assigns a random-suffixed domain but
  nothing registered `<deployed-url>/login/callback` on the project's OIDC
  client, so the FIRST login on a new deployment failed with
  `redirect_uri_not_registered`. After the URL resolves, each command checks
  the project's OIDC clients for the deployed callback and warns on stderr
  with the exact fix command when it is missing; pass `--register-callback`
  to have it appended in the same run (merged save, then re-read to verify).
  The check reads the client LIST, not the repo's secrets -- RepoSecret/value
  is plaintext and audited on every call, so it is read only to pick the
  app's client (its `*OIDC_CLIENT_ID` key) when several clients exist and
  none has the callback. Advisory: it never fails the deploy and stdout
  stays one `--json` document.

## 0.4.1

### Fixed

- Ten save/update commands no longer wipe the fields they were not asked
  to change. Their endpoints replace the whole stored document from the
  request DTO, so an omitted field arrived as the C# default (false, 0, "",
  empty list) and overwrote what was there. Each command now reads the
  current record and merges the flags over it, the way `iam permissions
  update`, `auth config save` and `auth oidc-clients save` already did
  (shared helper: `src/lib/merge-current.ts`). Omitting a flag keeps the
  stored value; pass it explicitly to clear it.
  - `iam signup-settings save`: `--default-roles participant` alone turned
    `isEmailPasswordSignUpEnabled` off and emptied the default permissions.
    The GET spells the lists `defaultRolesForNewUser`/`...Permissions...`
    while the POST binds `...OnSignUp`, so the merge renames them.
  - `iam roles update`: a rename cleared the description, detached the
    parent role and turned `canCreateOwn` off.
  - `auth client-credentials save --item-id`: a roles-only save re-activated
    a disabled credential, reset the token lifetime to 5 minutes and dropped
    every permission. The secret is never carried.
  - `data config update`: a connection-string-only update reset
    `isCollectionNameEditable` and `collectionNamePattern`.
  - `localization key save`: `--value` replaced every translation with the
    one culture passed, and a save without `--value` dropped them all. It now
    upserts that culture's entry and keeps the rest; `--culture` is required
    with `--value`.
  - `localization glossary save --item-id`: dropped language, type, context,
    note, `isGlobal` and module tags.
  - `localization language save`: re-saving the default language without
    `--is-default` demoted it. The name is matched exactly (case included),
    like the server's own lookup -- a differently-cased name is a create, and
    must not inherit this record's `isDefault`.
  - `mail config save --configuration-id`: a host-only update turned SSL off,
    flipped inbound to outbound, reset the provider and dropped
    `isEnableSnsConfiguration`. `--account-password` is still required on
    update (the server insists, and returns it masked).
  - `notification save`: changing one of channel/type/persistence reset the
    other two. When the name already exists the CLI also sets
    `isUpdateRequest: true` automatically -- without it the server rejects
    every update as a duplicate name. Name matching is exact (case included),
    like the server's own lookup.
  - `captcha save <id>`: rotating the secret disabled the configuration and
    blanked its site key. `--provider` is now only required on create.
- Every `release` command hit `/release/v4/api/...` and got the gateway's HTML
  error page back ("Blocks API returned HTML for /release/v4/api/Build/repos-list").
  blocks-release routes are `[Route("[controller]")]` with no `api` segment, like
  every other service behind the gateway; the base is now `/release/v4`. The
  portal's `/api` prefix is its own dev-proxy base, not a gateway path.
- `blocks logout` posted to `/iam/v4/api/auth/logout` for the same reason; it
  now uses `/iam/v4/auth/logout`, matching the impersonate/stop calls beside it.
- `storage config delete` sent `DELETE`, but blocks-os declares Storage/Delete
  as a POST (unlike Mail/Delete and Notification/Delete, which are DELETEs), so
  every delete got 405. Found in a sweep of all 180+ CLI endpoints against the
  service controllers; this was the only remaining route/verb mismatch. Known
  server-side quirk from the same sweep, not fixable client-side: `notifier
  unread`'s filter is declared body-bound on a GET, so the CLI's query-string
  flattening is not honored until blocks-logic reads it from the query.
- `iam users access grant` dry-run and confirmation now show the
  organization's current roles and permissions. The endpoint keeps a list
  you omit (for an existing member; a first grant into a new organization
  starts the omitted list empty) but REPLACES one you pass, so `--roles
  editor` on an admin left them with editor only -- that is now visible
  before `--yes`.
- `iam users update` matches what blocks-iam ships today: `POST /users/{id}`
  is a sparse patch (omitted/null keeps the stored value, `""` via `--body`
  clears it), so the CLI sends only the fields you pass and no longer needs a
  read. Roles, permissions, `mfaEnabled` and `userMfaType` were retired from
  this endpoint -- the server ignores them with only a log line -- so the CLI
  now rejects them with a typed error pointing at `iam users access grant`
  and the MFA commands instead of letting the change silently not happen.

### Added

- `npm run verify:endpoints` (`scripts/verify-endpoints.mjs`): checks every
  route+verb the CLI sends against the ASP.NET controllers in the checked-out
  sibling service repos, so a moved route or changed verb fails mechanically
  instead of surfacing as a live 404/405. Route+verb only -- DTO shapes and
  replace-vs-patch semantics still need the server source read.

### Changed

- The dry-run of a merging save/update command performs the read it merges
  from, so it needs a selected project and network access; create-path
  dry-runs (no id) stay offline as before, and so does `iam users update`
  (a sparse patch needs no read).
- `iam users update` no longer accepts `--roles`/`--permissions` (see Fixed).

## 0.4.0

### Added

- New `captcha` family (blocks-os `/os/v4/captcha/*`): `list` (with
  `activeForLogin`, the configuration blocks-iam enforces -- the first enabled
  record in id order), `get`, `save` (create/update; `--captcha-secret` stores
  or replaces the secret and is redacted in dry-run, never echoed back),
  `enable`/`disable` (compound: re-save with only `isEnable` flipped and report
  which record is live), and `delete`.
- New `secrets` family (blocks-os `/os/v4/Secrets/*`): `list`, `get`, `set`
  (value from `--value-file`, `--value-env` or `--value`; redacted in dry-run),
  `set-many` (one secret per dotenv key), `update`, `rotate`,
  `lock`/`unlock`/`delete`/`restore`, `access` (replace, `--merge`, or
  `--clear`), and `audit`. The CLI never prints a secret value -- the server's
  read-value endpoints are deliberately not exposed -- and always writes the
  default secret type.

- 18 new `release` commands covering the full blocks-release surface, all
  CLI-side against existing APIs: `release setup` (first-time deploy via
  `Build/run-build` with `--hosting-provider`/`--region`/`--machine-config`
  resolved by name or id), `release logs <buildId>` (stored pipeline events,
  `--follow` streams until terminal, `--group` filters by stage),
  `release repos list` / `release repo get <repo>` (registered-repo inventory
  with compact mapped rows), `release settings list` (hosting choices),
  `release domain set <domain>`, `release git repos|branches`
  (`--provider` defaults to `github`, the only active provider; others fail
  with `provider_not_supported` so no rename is needed when more go live),
  `release secrets sync|list|lock|unlock|delete|restore|audit` (the server
  stores one whole secret set per repo; `sync` bulk-upserts a dotenv file,
  merge by default, removals only behind `--prune`, key names only in output),
  `release reports get <buildId> --type sast|sca-container|sca-libraries|dast`
  (the server's own report types), `release monitor list`, and
  `release teardown <repo>` (explicit repo required, confirmation states the
  namespace and URL being destroyed).
- `release deploy` gained `--repo <name|id>` (explicit repo selection via
  `Build/repos-list`), `--with-secrets <dotenvFile>` (runs secrets sync
  first and reports it as `secretsSync` in the final document, so `--json`
  stdout stays one document), and `--follow` (streams build events to
  stderr while waiting).
- `release secrets sync` starts from an empty set only on the server's
  not-found answer; any other failure reading the current set aborts with
  `secrets_read_failed` before saving, because save replaces the whole set.
- `release status` gained `--wait`/`--follow` and both it and the deploy wait
  now emit a stable `verdict` field (`succeeded`/`failed`/`running`).

### Fixed

- `--wait` terminal detection reads the build's status FIELD against the
  server's own terminal vocabulary (Succeeded/Failed/Cancelled/Timeout/...)
  instead of keyword-scanning every string in the response, where a commit
  message like "fix error handling" made a running build read as finished
  and an unlisted status word made a finished build wait out the full
  timeout.
- All wait/follow progress now goes to stderr; `--json` stdout is exactly one
  parseable document instead of one JSON dump per poll.
- `release deploy --domain` names the domain change in its confirmation
  prompt instead of silently updating the domain before deploying.

### Changed

- `release builds list` resolves the repo by name or id from
  `Build/repos-list` (auto-picked only when exactly one repo is registered;
  otherwise a typed `repo_ambiguous` error listing candidates - it no longer
  prompts interactively), supports `--branch`, `--page`, and `--page-size`,
  and returns mapped rows with `totalCount` instead of the raw envelope.
- `release builds get` (a pure alias of `release status`) is removed; use
  `release status <buildId>`.

## 0.3.3

### Fixed

- Native credential writes (macOS Keychain, Linux Secret Service, Windows
  DPAPI) are verified by reading the value back before the CLI reports
  success. Previously `security add-generic-password` could exit 0 while
  storing an empty password (its prompt reads the terminal, not the stdin
  pipe), after which the CLI deleted `tokens.json` and `blocks login` printed
  `Login done.` on a machine that had just lost its tokens. A write that does
  not round-trip now fails with `secret_store_write_failed` and the next step
  `Set BLOCKS_SECRET_STORE=file`, and `tokens.json` is only removed after the
  native store has proven it holds the tokens.
- Migrating an existing `tokens.json` into a native credential store (which
  happens on the read path) is best-effort: when the native write fails, the
  CLI warns on stderr and keeps serving the file instead of destroying the
  only readable copy or failing the command.
- A stale or manually created entry occupying the CLI's credential-store slot
  surfaces as an actionable `token_store_unreadable` error instead of crashing
  every command with a raw `SyntaxError`.
- The macOS Keychain write uses the argv form of
  `security add-generic-password -w` again -- the stdin form did not
  round-trip on real Macs (see above). The token payload is escaped to plain
  ASCII before storage so `security`'s hex-dumping of non-ASCII data cannot
  fail verification for stores containing unicode account or project names.

### Added

- `BLOCKS_SECRET_STORE` also accepts `windows-dpapi`, `macos-keychain`, and
  `linux-secret-service` to force a specific native backend. The test suite
  uses this to exercise the native code paths deterministically; write
  verification makes a wrong override fail loudly rather than lose
  credentials.

## 0.3.2

### Added

- After every command, the CLI checks the npm registry for a newer
  `@seliseblocks/cli-os` (at most once every 24 hours, cached in the config
  directory as `update-check.json`) and prints an `Update available` notice to
  stderr — stdout stays clean for `--json` parsers. The notice tells agent
  sessions to inform the user and ask for confirmation before updating; the CLI
  never updates itself. Set `BLOCKS_NO_UPDATE_CHECK=1` to disable.
- `blocks doctor` gained a "CLI up to date" check and, in `--json`, top-level
  `cliVersion`, `latestCliVersion`, and `cliUpdateAvailable` fields. It reads
  the cached registry lookup only — doctor still makes no network request —
  and an outdated version never fails the run, so scripts gating on doctor's
  exit code don't break the day a release ships.
- `blocks-bootstrap` skill and `AGENT_GUIDE.md` now instruct agents to compare
  `blocks --version` against `npm view @seliseblocks/cli-os version` at session
  start and ask the user before upgrading — this works even when the installed
  CLI predates the built-in notice.

## 0.3.1

### Changed

- README's "Account, project, and session context" trimmed from 62 lines to 19:
  state location, account/project resolution order, and the `use`/`deselect`
  one-mode rule. The token-exchange state machine, its diagram, and the Code
  Studio launcher requirements moved to `AGENT_GUIDE.md`, which already covered
  the same ground — two copies of it would drift.
- Documented that `auth status` reporting the account tokens as `missing` after
  `blocks use` is the expected account→project exchange, not a fault.


## 0.3.0

### Added

- `blocks help`, `blocks help <family>`, and `blocks help <command>` — a command
  reference generated from each command's own source, so flags, scope, and
  mutating status cannot drift from behavior.
- `<command> --help` and `<command> -h` now print that same reference. They
  previously reached the handler as an ordinary argument and ran the command for
  real: `blocks login --help` performed an actual login attempt.
- Flags a command does not read are now reported instead of silently dropped. A
  misspelled flag (`--hostt` for `--host`) used to vanish, leaving a clean-looking
  dry-run with the field missing, which could then be approved and applied.
  The warning goes to stderr; set `BLOCKS_STRICT_FLAGS=1` to fail instead.

### Changed

- Every data-model mutation now reloads the Data Gateway. Schema, rules, validation
  and data-source writes were staged until a later `data reload`, so a command could
  report success while the change stayed invisible to the running app.
- Newly created schemas are granted Public access on all four operations. Neither
  create endpoint accepts an access level, so new schemas landed on the entity
  default of `User` and were unreadable to anonymous callers. Applied at creation
  only — a level changed later survives subsequent pushes.
- `blocks auth oidc-clients save` defaults `isAutoRedirect` and
  `registerAsIdentityProvider` to true when registering a new client. Without both,
  a bootstrap client has no linked identity provider and stalls on an interstitial
  page instead of reaching the provider. Updates are unaffected.
- Removed the `secrets` commands; the Secrets API they targeted no longer accepts
  them (`405`).
- `blocks new web` scaffolds keep the OIDC refresh token in memory only. It was
  written to `sessionStorage`, where any XSS payload could read it; the stored
  access token plus IAM's httpOnly session cookie cover reloads.
- The scaffold's `@seliseblocks/client` pin tracks the client release it ships
  beside (now `^0.2.0`, previously a stale `^0.1.3` that would have frozen new
  apps on the 0.1 line).
- Removed the dashboard and assets features from the web scaffold.
- Secret redaction moved to one shared helper with a build-time check, replacing
  nine per-command implementations.

### Fixed

- `blocks iam users list` and `blocks data files info` returned an empty `data`
  array alongside a non-zero `totalCount` at their documented default `--page 1`:
  both endpoints skip by `PageSize * Page` and are 0-based, so page 1 skipped the
  only page. A project with users read as empty. `iam roles list` and
  `iam permissions list` already converted correctly; the conversion is now one
  shared helper. Data's schema endpoints take a 1-based `PageNo` and are unchanged.
- `blocks iam roles list` and `blocks iam permissions list` failed with a bare 400
  on their default invocation. Both filters declare a non-nullable `Search`, and
  permissions additionally declares `IsBuiltIn` as a `"yes"`/`"no"` string, not a
  boolean — sending a JSON boolean failed to bind the whole body. Blank now means
  "no filter", matching the service.
- `blocks iam users update` failed with a bare 400: IAM validates `ItemId` from the
  body, not the path segment.
- `blocks iam permissions update` rejected any partial edit. The endpoint replaces
  the whole document and requires `Name`, `Resource` and `ResourceGroup`; the
  command now reads the current permission and merges over it.
- API validation failures printed only the generic headline. ASP.NET ProblemDetails
  reports `title` as "One or more validation errors occurred." and names the failing
  field in a sibling `errors` object, which was discarded — every 400 was opaque.
- `blocks iam users list --sort-desc` had no effect when passed as a bare flag:
  it was read as a string and compared to `"true"`, so only `--sort-desc true`
  worked. Every other list command already handled it correctly.
- `blocks help iam users list` documented a `--filter` flag that does not exist.
  Filters beyond `--email`/`--name`/`--organization-id` go in
  `--body '{"filter":{...}}'`.
- `blocks data files upload-to-url --dry-run` printed the pre-signed URL in full,
  including the SAS token or signature in its query string. It now shows the
  origin and path only.
- Ten command summaries were flag syntax or a bare warning rather than a
  description; `data files access-grant` read only
  `--principal-type User|Role|Everyone|Organization`.
- Dry-run output no longer prints un-encoded ids in the endpoint it reports, so
  it matches the URL actually called.
- API error messages with no recognized message field are redacted and length
  capped before being printed, in case the service echoed the request back.

### Security

- `auth oidc-clients list` and `get` redact `clientSecret`. The service documents it
  as excluded from both, but returns the stored registration verbatim, so the secret
  was retrievable indefinitely — including for public PKCE clients, which have no use
  for one. Use `rotate-secret` to obtain a working secret. The service-side leak
  remains; this only protects CLI output.
- On macOS, the keychain write passes the secret through stdin rather than as a
  `security add-generic-password -w <secret>` argument, which was readable via
  `ps` by any process running as the same user. Falls back to the previous form
  if the stdin spelling fails.
- On Windows, the DPAPI helper receives the plaintext on stdin rather than in an
  environment variable.
- The macOS keychain backend is probed for availability the way the Linux one
  already was, instead of being assumed and throwing when unavailable.
- `blocksRequest` refuses an absolute URL whose origin is not the resolved API
  origin, so a path can never redirect an account or project token elsewhere.
- `--api-url` prints a warning naming the host when it differs from the account's
  configured API, since the request still carries that account's token.

### Package metadata

- Added `repository`, `homepage`, `bugs`, `author`, and `keywords`.
- `LICENSE` now matches the repository's copyright line.
