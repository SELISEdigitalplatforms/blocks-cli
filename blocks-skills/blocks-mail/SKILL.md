---
name: blocks-mail
description: "Send transactional email via the SDK's `blocksClient.mail.send()`/`sendToAny()` (`/logic/v4/Mail/Send`+`/SendToAny`), or administer mail via the project-scoped `blocks mail config|template|mailbox *` CLI (`/os/v4/Mail/*`) — server config, template CRUD/clone, mailbox reads, none of which have an SDK equivalent. CLI also exposes `mail send`/`sendtoany` as an admin/terminal mirror of the SDK calls. CLI mutations require `--dry-run` before `--yes`. Use for app email sending, or managing SMTP/inbound providers, templates, mailbox history."
---

# Blocks Mail

Blocks mail has **two distinct surfaces that don't fully overlap**:

- **SDK — `blocksClient.mail.send()` / `sendToAny()`** — the only mail operations exposed to app code. Use this when the question is "how do I send an email from my app."
- **CLI — `blocks mail config|template|mailbox *`** — server/provider configuration, email template CRUD/clone, and mailbox message reads. **No SDK equivalent at all.** The SDK's own source (`blocks-client/src/mail/mail-client.ts`) says so directly: "Mail server/template/mailbox management (Mail/Save, Mail/Get, templates, mailbox reads) is a CLI/admin concern and is not exposed here." If a user asks "how do I configure our SMTP provider from my app" or "how do I edit a template from code," the answer is: you don't — that's a `blocks mail config *` / `blocks mail template *` terminal command, not an SDK call.
- **CLI — `blocks mail send` / `blocks mail sendtoany`** — also exist, hitting the *same* `/logic/v4/Mail/Send` and `/logic/v4/Mail/SendToAny` endpoints as the SDK's `send`/`sendToAny`. These are the terminal/admin-token way to fire the same send, not a different feature — useful for testing a template from a shell or scripting a one-off send, but app runtime code should use the SDK call instead of shelling out.

## SDK — sending mail (`blocksClient.mail.*`)

```ts
import { blocksClient } from "../../lib/blocks/client";

await blocksClient.mail.send({
  to: ["jane@example.com"],
  purpose: "welcome",
  language: "en",
  subjectDataContext: { firstName: "Jane" },
  bodyDataContext: { firstName: "Jane" }
});
```

- **`blocksClient.mail.send(request)`** — `POST /logic/v4/Mail/Send`. Sends through the tenant's default mail configuration.
- **`blocksClient.mail.sendToAny(request)`** — `POST /logic/v4/Mail/SendToAny`. Same request shape plus `isTestMail`.

`BlocksSendMailRequest` fields (from `blocks-client/src/mail/types.ts`): `to?: string[]`, `cc?: string[]`, `bcc?: string[]`, `replyTo?: string[]`, `attachments?: string[]`, `language?: string`, `purpose?: string`, `projectKey?: string` (defaults to the tenant's `x-blocks-key` server-side when omitted), `subjectDataContext?: Record<string, string>`, `bodyDataContext?: Record<string, string>`, `sendPhoneNumberAsEmail?: boolean`. `BlocksSendMailToAnyRequest` extends that with `isTestMail?: boolean`. The response type (`BlocksMailPassThroughResponse`) is an untyped `Record<string, unknown>` — the SDK doesn't shape the response further.

`purpose`/`language` are how the send picks a template server-side; the CLI and SDK source don't define what `purpose` values exist for a given tenant — that comes from whatever templates were saved via `mail template save` (see below), so don't guess a purpose string that hasn't been confirmed to exist.

## CLI — administering mail (`blocks mail config|template|mailbox *`)

Everything under `mail config`, `mail template`, and `mail mailbox` is project-scoped: every command passes `impersonatedProjectAuth: true` and resolves the target project via `selectedProject(flags)` — i.e. whichever project is selected with `blocks use <tenantId>`, or the workspace's `blocks.json`, or an explicit `--project <tenantId>`. There is no account-level mode for any mail command, including `mail send`/`mail sendtoany`.

### `mail config` — SMTP/inbound provider configuration (`/os/v4/Mail/*`)

- **`blocks mail config list [--json]`** — `GET /os/v4/Mail/Gets`. Read-only.
- **`blocks mail config get <name> [--json]`** — `GET /os/v4/Mail/Get?ConfigurationName=<name>` (positional arg, or `--name`). Read-only.
- **`blocks mail config save [--configuration-id <id>] [--name <n>] [--host <h>] [--port <p>] [--enable-ssl] [--inbound] [--provider <n>] [--sender-name <n>] [--sender-address <addr>] [--sender-username <u>] [--account-password <p>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — `POST /os/v4/Mail/Save`. Upsert: omit `--configuration-id` to create, pass it to update. `--provider` and `--port` are raw integers (the CLI doesn't document the provider enum's meaning — don't guess a value). `--account-password` is redacted (`***`) in `--dry-run` output only; the live response and stored value are still sensitive.
- **`blocks mail config delete <configurationId> [--dry-run] [--yes] [--json]`** — `DELETE /os/v4/Mail/Delete?ConfigurationId=<id>`.
- **`blocks mail config duplicate <configurationId> [--dry-run] [--yes] [--json]`** — `POST /os/v4/Mail/Duplicate` with body `{ configurationId }`.

### `mail template` — email template CRUD/clone (`/os/v4/Mail/*Template*`)

- **`blocks mail template list [--configuration-id <id>] [--language <l>] [--search <q>] [--sort-by <field>] [--sort-desc] [--page-number 1] [--page-size 20] [--json]`** — `GET /os/v4/Mail/GetTemplates`. Read-only.
- **`blocks mail template get <itemId> [--json]`** — `GET /os/v4/Mail/GetTemplate?ItemId=<id>`. Read-only.
- **`blocks mail template save [--item-id <id>] [--name <n>] [--configuration-id <id>] [--language <l>] [--subject <s>] [--template-body <html>] [--json-content <json>] [--image-id <id>] [--image-url <url>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — `POST /os/v4/Mail/SaveTemplate`. Upsert: omit `--item-id` to create, pass it to update.
- **`blocks mail template delete <itemId> [--dry-run] [--yes] [--json]`** — `DELETE /os/v4/Mail/DeleteTemplate?ItemId=<id>`.
- **`blocks mail template clone <itemId> [--name <n>] [--configuration-id <id>] [--language <l>] [--subject <s>] [--dry-run] [--yes] [--json]`** — `POST /os/v4/Mail/CloneTemplate` with body `{ itemId, ...compact overrides }`.

### `mail mailbox` — mailbox message reads (`/os/v4/Mail/GetMailBoxMail*`)

- **`blocks mail mailbox list [--inbound] [--page-number 1] [--page-size 20] [--search <q>] [--start-date <date>] [--end-date <date>] [--status <s>] [--json]`** — `GET /os/v4/Mail/GetMailBoxMails`. Read-only. There is **no `--configuration-id` flag** on this command (see Gotchas — this corrects a stale example elsewhere in this repo's own docs).
- **`blocks mail mailbox get <messageId> [--json]`** — `GET /os/v4/Mail/GetMailBoxMail?MessageId=<id>` (positional arg, or `--id`). Read-only.

### `mail send` / `mail sendtoany` — CLI mirror of the SDK send calls

- **`blocks mail send [--to a,b] [--cc a,b] [--bcc a,b] [--reply-to a,b] [--purpose <p>] [--language <l>] [--project-key <k>] [--subject-data-context '<json>'] [--body-data-context '<json>'] [--attachments '<json>'] [--send-phone-number-as-email] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — `POST /logic/v4/Mail/Send`. `--project-key` defaults to the selected project's tenant id.
- **`blocks mail sendtoany [same flags, plus --is-test-mail] [--dry-run] [--yes] [--json]`** — `POST /logic/v4/Mail/SendToAny`.

`--to`/`--cc`/`--bcc`/`--reply-to` are comma-separated lists (`a@x.com,b@y.com`); `--attachments`/`--subject-data-context`/`--body-data-context` take raw JSON strings (parsed with `JSON.parse`, so quote them for the shell).

## Mutation discipline

Every write command (`config save/delete/duplicate`, `template save/delete/clone`, `send`, `sendtoany`) follows the same two-gate pattern used throughout this CLI:

1. **`--dry-run`** short-circuits before any network call and prints `{ dryRun: true, endpoint, request }` (or `query` for `delete`) — a full preview of exactly what would be sent, with secrets already redacted.
2. Without `--dry-run`, **`confirmMutation`** either accepts `--yes` outright or, interactively, prompts "...Type 'yes' to continue:" and throws `Cancelled.` on anything else. There is no way to mutate without one of these two gates.

`list`/`get` commands under `config`, `template`, and `mailbox` never mutate and need neither flag.

## Gotchas

- **The premise that mail has no SDK path at all is wrong for sending.** `blocksClient.mail.send()`/`sendToAny()` exist and are the correct answer for "send email from my app." Only `config`/`template`/`mailbox` administration is CLI-only.
- **`mail mailbox list` does not take `--configuration-id`.** This repo's own `blocks-cli/AI_USAGE_GUIDE.md` shows an example (`blocks mail mailbox list --configuration-id <id> --json`) that isn't backed by the actual flag list in `blocks-cli/src/commands/mail/mailbox/list.ts` — that command only reads `--inbound`, `--page-number`, `--page-size`, `--search`, `--start-date`, `--end-date`, `--status`. The CLI's flag parser silently ignores unrecognized `--` flags rather than erroring, so that stale example "works" without doing what it implies. Don't repeat it; use the real flags above.
- **`--account-password` (config save) is redacted only in `--dry-run` output.** The live `config save`/`config get` response is not redacted — treat it as a secret regardless.
- **`--provider` and `--port` on `config save` are raw values with no documented enum/meaning in the CLI source** — don't invent what a given integer means; ask the user or read it back from `config get` on an existing configuration.
- **`purpose`/`language` on `send`/`sendtoany` select a template implicitly** — there's no lookup or validation in the CLI/SDK source for which `purpose` strings are valid for a tenant. Confirm against `mail template list`/`get` rather than guessing a purpose name.
- **`mail send` and `mail sendtoany` are still project-scoped CLI commands**, not account-level — same `selectedProject`/impersonated-token requirement as `config`/`template`/`mailbox`.
- **`--dry-run` before `--yes`, always** — same discipline as every other mutating `blocks` command in this pack; never jump straight to `--yes` on a mail write.

## Example trigger prompts

- "Send a welcome email to jane@example.com from the app." → SDK `blocksClient.mail.send(...)`.
- "Send a test email to this address from the terminal." → `blocks mail sendtoany --to <addr> --is-test-mail --dry-run --json`, then `--yes` after approval.
- "List the mail server configurations for this project." → `blocks mail config list --json`.
- "Set up a new SMTP configuration for this project." → `blocks mail config save --name <n> --host <h> --port <p> --enable-ssl --sender-name <n> --sender-address <addr> --account-password <p> --dry-run --json`, then `--yes`.
- "Show me the password-reset email template." → `blocks mail template list --search <query> --json`, then `blocks mail template get <itemId> --json`.
- "Clone this template into a new language." → `blocks mail template clone <itemId> --language <code> --name <n> --dry-run --json`.
- "What mail was sent out last week?" → `blocks mail mailbox list --start-date <date> --end-date <date> --json`.
- "How do I edit an email template from my app's code?" → not supported; template CRUD is CLI-only (`blocks mail template save`), no SDK path.
