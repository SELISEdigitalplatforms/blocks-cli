# Changelog

All notable changes to `@seliseblocks/cli-os`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions before 0.3.0 were released without a changelog; their history is in the
repository's git log.

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
