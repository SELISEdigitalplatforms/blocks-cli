# Changelog

All notable changes to `@seliseblocks/cli-os`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions before 0.3.0 were released without a changelog; their history is in the
repository's git log.

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
