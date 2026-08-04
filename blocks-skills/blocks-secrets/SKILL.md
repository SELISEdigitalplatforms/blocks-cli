---
name: blocks-secrets
description: "Save and retrieve arbitrary named secret values (e.g. captcha provider config, third-party API keys) for a SELISE Blocks project via the blocks CLI's 'secrets get'/'secrets save' commands ('/os/v4/Secrets/Gets'/'/Save'), project-scoped with an impersonated project token. CLI-only surface, no SDK equivalent by design. Storage is generic key/value - shape depends entirely on the secret key, not fixed per type. Use for saving/rotating a secret's key-value pairs or reading one back. get's response is the raw, unredacted value - treat CLI output as sensitive."
---

# Blocks Secrets

This skill manages **generic tenant secret storage** — arbitrary named secret values scoped to a project, via the `blocks secrets *` CLI. It is not tied to any one feature: a project can store a `captcha` secret, an `smtp` secret, or anything else under whatever `secretKey` name it chooses. The shape of the stored value is a flat, caller-defined JSON object (`--key-value-pairs`) — there is no fixed schema across secrets.

**CLI-only, no SDK path, by explicit design.** There is no `@seliseblocks/client` method anywhere in `blocks-client/src` for reading or writing tenant secrets (the only "secret" hits in that package are unrelated: MFA enrollment secrets and OIDC `clientSecret` in the auth client). If a user wants to store or fetch a project secret, `blocks secrets get`/`blocks secrets save` is the only path — don't suggest an SDK call for this.

**Prerequisite:** a project is selected (`blocks use <tenantId>`). If login/project state is unknown, run **[blocks-onboarding](../blocks-onboarding/SKILL.md)** first.

## Command family

Both commands hit `/os/v4/Secrets/*` and require an **impersonated project token** (`impersonatedProjectAuth: true` + `projectTenantId` from `selectedProject(flags)`) — there is no account-token path, consistent with `storage config *` and other project-scoped admin surfaces.

| Command | Endpoint | Notes |
|---|---|---|
| `blocks secrets get <secretKey>` | `/os/v4/Secrets/Gets` (GET) | `<secretKey>` positional, or `--secret-key` (required if no positional). Also takes `--page-number` (default `0`) / `--page-size` (default `10`). Read-only. Response is `unknown` to the CLI and printed as-is — **not redacted** (see Gotchas). |
| `blocks secrets save` | `/os/v4/Secrets/Save` (POST) | Upsert — create or update. Mutating; standard `--dry-run`/`--yes` discipline applies. |

```bash
blocks secrets get captcha --json
blocks secrets get --secret-key captcha --page-size 25 --json
```

The `secretKey` positional argument wins over `--secret-key` if both are somehow given (`args[0] || stringFlag(flags, "secret-key", { required: true })`); only one is required. The endpoint name (`Gets`, plural) and the paging flags imply the response is a paged list of items filed under that `secretKey`, not necessarily a single flat value — the CLI's own type for the result is just `unknown`, so confirm actual shape from what the call returns rather than assuming a single-object response.

## `secrets save` — fields

`save` builds its POST body from `--body`/`--file` (a raw JSON object, spread first) merged with these convenience flags (spread second, so they win if both are given):

| Flag | Body field |
|---|---|
| `--secret-key` | `secretKey` |
| `--item-id` | `itemId` |
| `--key-value-pairs` | `keyValuePairs` |

`--key-value-pairs` takes a JSON **object** string (e.g. `'{"isEnable":"true"}'`) — the CLI rejects arrays or non-objects with `--key-value-pairs must be a JSON object`. Unset convenience flags are dropped (`compact`), so they never overwrite a field already present in `--body`/`--file`.

```bash
blocks secrets save --secret-key captcha \
  --key-value-pairs '{"isEnable":"true","provider":"recaptcha","captchaKey":"...","captchaSecret":"..."}' \
  --dry-run --json

blocks secrets save --secret-key captcha \
  --key-value-pairs '{"isEnable":"true","provider":"recaptcha","captchaKey":"...","captchaSecret":"..."}' \
  --yes --json

# Update an existing secret record
blocks secrets save --secret-key captcha --item-id <itemId> --key-value-pairs '{...}' --yes --json
```

`save` is create-or-update in one command: omit `--item-id` to create, pass it to update. The captcha example above is only an illustration used in this repo's own docs/tests — `--key-value-pairs` accepts whatever fields the caller's `secretKey` namespace needs.

## `--dry-run` before `--yes` — always

`save` follows the standard `blocks` mutation discipline (`confirmMutation`): passing neither `--dry-run` nor `--yes` drops into an interactive `Save secret '<secretKey>'. Type 'yes' to continue:` prompt, which is not viable in a scripted/agent context — always pass one explicitly.

- `--dry-run` short-circuits **before** the confirmation prompt and **before any network call**: it prints `{ dryRun: true, endpoint: "/os/v4/Secrets/Save", request: <redacted body> }` and returns.
- `--yes` skips the interactive prompt and sends the real POST.

The dry-run preview's redaction is narrow: it walks `body.keyValuePairs` only, and replaces the *value* of any entry whose *key* matches `/secret|password|key$/i` (case-insensitive) with `"***"`. It does **not** touch `secretKey`/`itemId` at the top level, and does **not** touch anything injected via `--body`/`--file` outside `keyValuePairs`. This redaction is preview-only — it never changes what is actually sent when `--yes` is used, and it has no effect on `secrets get`'s response or on the live response from `save` itself.

## Gotchas (secret-handling — read before running either command)

- **`get`'s response is raw and completely unredacted.** `secretsGet` (`get.ts`) applies zero masking — the API result is passed straight to `writeOutput` and printed verbatim. There is no masked/redacted variant of this command. Whatever is stored under that `secretKey` comes back in full, as-is. Treat the output as sensitive: don't repeat the value back to the user beyond what they explicitly asked for, don't paste it into chat/logs/tickets, and never write it into a file that could get committed.
- **`save`'s live response is also unredacted.** The dry-run preview masks secret-shaped `keyValuePairs` keys, but that's a preview-only convenience. The actual POST always sends plaintext values, and whatever `/os/v4/Secrets/Save` returns is written unredacted too — if the API echoes the saved value back, handle that response with the same care as `get`'s.
- **This is generic storage, not a captcha-specific feature.** `--key-value-pairs` is a flat JSON object whose fields are entirely defined by whoever picked the `secretKey` — there's no schema registry. Don't assume `isEnable`/`provider`/`captchaKey`/`captchaSecret` apply to a secret that isn't actually a captcha config.
- **Impersonated project token only, no account-token path.** Both commands require `selectedProject`/`blocks use <tenantId>` first — same pattern as `storage config *`.
- **No SDK equivalent exists.** Don't reach for `@seliseblocks/client` for this; the CLI is the only surface, by design.
- **`save` is upsert, not two verbs.** Whether a call creates or updates is decided by the presence of `--item-id`, not by a different command name.

## Example trigger prompts

- "Save our reCAPTCHA settings as a project secret." → `secrets save --secret-key captcha --key-value-pairs '{...}' --dry-run --json`, confirm, then re-run with `--yes`.
- "What's stored under the `captcha` secret?" → `secrets get captcha --json` — tell the user the raw stored value will be printed, and don't restate it beyond what they asked for.
- "Rotate the captcha secret key." → `secrets save --secret-key captcha --item-id <itemId> --key-value-pairs '{...}' --yes --json` (update path — need the existing `itemId`, typically from a prior `secrets get`).
- "Is there a way to list every secret in the project?" → there's no list-all; `secrets get` requires a `secretKey` and pages within it (`--page-number`/`--page-size`), it doesn't enumerate unknown keys.
- "Can I read this from my frontend app with the SDK?" → no — `blocks secrets *` is CLI/admin-only; don't scaffold an SDK call, and never put a secret value into frontend code or a committed `.env` file.
