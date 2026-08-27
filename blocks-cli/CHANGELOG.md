# Changelog

All notable changes to `@seliseblocks/cli-os`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions before 0.3.0 were released without a changelog; their history is in the
repository's git log.

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
