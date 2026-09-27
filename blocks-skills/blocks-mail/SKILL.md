---
name: blocks-mail
description: "Send transactional email via the SDK's `blocksClient.mail.send()`/`sendToAny()`, or administer mail via the project-scoped `blocks mail config|template|mailbox *` CLI — server config, template CRUD/clone, mailbox reads, none of which have an SDK equivalent. CLI also exposes `mail send`/`sendtoany` as an admin/terminal mirror of the SDK calls. CLI mutations require `--dry-run` before `--yes`. Use for app email sending, or managing SMTP/inbound providers, templates, mailbox history."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Mail

For CLI work, use blocks-bootstrap first when account or project context is
unknown. Mail operations must not choose or repair authentication context as a
side effect.

Blocks mail has **two distinct surfaces that don't fully overlap**:

- **SDK — `blocksClient.mail.send()` / `sendToAny()`** — the only mail operations exposed to app code. Use this when the question is "how do I send an email from my app."
- **CLI — `blocks mail config|template|mailbox *`** — server/provider configuration, email template CRUD/clone, and mailbox message reads. **No SDK equivalent at all.** The SDK's own documentation says so directly: mail server/template/mailbox management is a CLI/admin concern, not exposed to app code. If a user asks "how do I configure our SMTP provider from my app" or "how do I edit a template from code," the answer is: you don't — that's a `blocks mail config *` / `blocks mail template *` terminal command, not an SDK call.
- **CLI — `blocks mail send` / `blocks mail sendtoany`** — also exist, hitting the *same* underlying send as the SDK's `send`/`sendToAny`. These are the terminal/admin-token way to fire the same send, not a different feature — useful for testing a template from a shell or scripting a one-off send, but app runtime code should use the SDK call instead of shelling out.

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

- **`blocksClient.mail.send(request)`** — sends through the tenant's default mail configuration.
- **`blocksClient.mail.sendToAny(request)`** — same request shape plus `isTestMail`.

`BlocksSendMailRequest` fields: `to?: string[]`, `cc?: string[]`, `bcc?: string[]`, `replyTo?: string[]`, `attachments?: string[]`, `language?: string`, `purpose?: string`, `projectKey?: string` (defaults to the tenant's `x-blocks-key` server-side when omitted), `subjectDataContext?: Record<string, string>`, `bodyDataContext?: Record<string, string>`, `sendPhoneNumberAsEmail?: boolean`. `BlocksSendMailToAnyRequest` extends that with `isTestMail?: boolean`. The response type is an untyped `Record<string, unknown>` — the SDK doesn't shape the response further.

`purpose`/`language` are how the send picks a template server-side; the CLI and SDK don't define what `purpose` values exist for a given tenant — that comes from whatever templates were saved via `mail template save` (see below), so don't guess a purpose string that hasn't been confirmed to exist.

## CLI — administering mail (`blocks mail config|template|mailbox *`)

Everything under `mail config`, `mail template`, and `mail mailbox` is project-scoped: every command requires an impersonated project session. Project resolution is an explicit `--project <tenantId>`, then the workspace's `blocks.json`, then the resolved account's selection from `blocks use <tenantId>`. There is no account-level mode for any mail command, including `mail send`/`mail sendtoany`.

### `mail config` — SMTP/inbound provider configuration

- **`blocks mail config list [--json]`** — read-only.
- **`blocks mail config get <name> [--json]`** — read-only (positional arg, or `--name`).
- **`blocks mail config save [--configuration-id <id>] [--name <n>] [--host <h>] [--port <p>] [--enable-ssl] [--inbound] [--provider amazon-ses|zoho|office365-smtp] [--security-mode legacy|none|starttls|ssl-on-connect] [--sender-name <n>] [--sender-address <addr>] [--sender-username <u>] [--account-password <p>] [--entra-tenant-id <id>] [--client-id <id>] [--client-secret <s>] [--mailbox-address <addr>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — the create-or-update call for a mail server, so omitting `--configuration-id` is what makes it a new one. `--provider` takes a name or its raw number (`amazon-ses`=0, `zoho`=1, `office365-smtp`=2); `--port` is a raw integer. `--account-password` and `--client-secret` are redacted (`***`) in `--dry-run` output only.
- **Password providers (Amazon SES, Zoho)** need `--host`, `--port`, `--sender-username` and `--account-password`. Zoho can be inbound; SES is outbound only.
- **`office365-smtp`** is outbound-only OAuth (client credentials): pass `--entra-tenant-id` (the Microsoft Entra tenant the app is registered in — not the Blocks tenant), `--client-id`, `--client-secret` and `--mailbox-address`, plus `--sender-name`/`--sender-address`. No `--account-password` (the server rejects one). The server fixes host (`smtp.office365.com`), port (587) and STARTTLS itself. The client secret goes to Blocks Secrets and is never returned — `config list` shows `isClientSecretConfigured` instead.
- Updating (`--configuration-id`) reads the stored configuration and merges, so `--enable-ssl`/`--inbound`/`--provider` and the Office 365 ids survive a host-only change. A password provider still needs `--account-password` on every update (it is returned masked, so it cannot be carried); an Office 365 update keeps the stored client secret unless `--client-secret` is passed, which rotates it. The provider and direction of an existing configuration cannot be changed.
- **`blocks mail config delete <configurationId> [--dry-run] [--yes] [--json]`**
- **`blocks mail config duplicate <configurationId> [--client-secret <s>] [--dry-run] [--yes] [--json]`** — an Office 365 copy requires its own `--client-secret`; a duplicate never shares the source's secret.

### `mail template` — email template CRUD/clone

- **`blocks mail template list [--configuration-id <id>] [--language <l>] [--search <q>] [--sort-by <field>] [--sort-desc] [--page-number 1] [--page-size 20] [--json]`** — read-only.
- **`blocks mail template get <itemId> [--json]`** — read-only.
- **`blocks mail template save [--item-id <id>] [--name <n>] [--configuration-id <id>] [--language <l>] [--subject <s>] [--template-body <html>] [--json-content <json>] [--image-id <id>] [--image-url <url>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — one template per language, so a multi-language template means one `save` per `--language`. Omitting `--item-id` creates rather than updates.
- **`blocks mail template delete <itemId> [--dry-run] [--yes] [--json]`**
- **`blocks mail template clone <itemId> [--name <n>] [--configuration-id <id>] [--language <l>] [--subject <s>] [--dry-run] [--yes] [--json]`**

### `mail mailbox` — mailbox message reads

- **`blocks mail mailbox list [--inbound[=false]] [--page-number 1] [--page-size 20] [--search <q>] [--start-date <date>] [--end-date <date>] [--status <s>] [--json]`** — read-only. There is **no `--configuration-id` flag** on this command.
- **`blocks mail mailbox get <messageId> [--json]`** — read-only (positional arg, or `--id`).

### `mail send` / `mail sendtoany` — CLI mirror of the SDK send calls

- **`blocks mail send [--to a,b] [--cc a,b] [--bcc a,b] [--reply-to a,b] [--purpose <p>] [--language <l>] [--project-key <k>] [--subject-data-context '<json>'] [--body-data-context '<json>'] [--attachments '<json>'] [--send-phone-number-as-email] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — `--project-key` defaults to the selected project's tenant id.
- **`blocks mail sendtoany [same flags, plus --is-test-mail] [--dry-run] [--yes] [--json]`**

`--to`/`--cc`/`--bcc`/`--reply-to` are comma-separated lists (`a@x.com,b@y.com`); `--attachments`/`--subject-data-context`/`--body-data-context` take raw JSON strings (parsed as JSON, so quote them for the shell).

## Mutation discipline

Every write command (`config save/delete/duplicate`, `template save/delete/clone`, `send`, `sendtoany`) follows the same two-gate pattern used throughout this CLI:

1. **`--dry-run`** short-circuits before any network call and prints a full preview of exactly what would be sent, with secrets already redacted.
2. Without `--dry-run`, a confirmation step either accepts `--yes` outright or, interactively, prompts to type "yes" to continue, and cancels on anything else. There is no way to mutate without one of these two gates.

`list`/`get` commands under `config`, `template`, and `mailbox` never mutate and need neither flag.

## Gotchas

- **The premise that mail has no SDK path at all is wrong for sending.** `blocksClient.mail.send()`/`sendToAny()` exist and are the correct answer for "send email from my app." Only `config`/`template`/`mailbox` administration is CLI-only.
- **`mail mailbox list` does not take `--configuration-id`.** The real command only reads `--inbound`, `--page-number`, `--page-size`, `--search`, `--start-date`, `--end-date`, and `--status`. Unknown flags are ignored by the generic parser, so use only the documented surface.
- **`--account-password` (config save) is redacted only in `--dry-run` output.** The API returns it masked, but treat anything credential-shaped in a live response as a secret regardless.
- **`--entra-tenant-id` is not `--project`.** It is the Microsoft Entra directory for the Office 365 app; the Blocks tenant always comes from the selected project.
- **`purpose`/`language` on `send`/`sendtoany` select a template implicitly** — there's no lookup or validation for which `purpose` strings are valid for a tenant. Confirm against `mail template list`/`get` rather than guessing a purpose name.
- **`mail send` and `mail sendtoany` are still project-scoped CLI commands**, not account-level — same project-selection/impersonated-token requirement as `config`/`template`/`mailbox`.
- **`--dry-run` before `--yes`, always** — same discipline as every other mutating `blocks` command in this pack; never jump straight to `--yes` on a mail write.

## Example trigger prompts

- "Send a welcome email to jane@example.com from the app." → SDK `blocksClient.mail.send(...)`.
- "Send a test email to this address from the terminal." → `blocks mail sendtoany --to <addr> --is-test-mail --dry-run --json`, then `--yes` after approval.
- "List the mail server configurations for this project." → `blocks mail config list --json`.
- "Set up a new SMTP configuration for this project." → `blocks mail config save --name <n> --host <h> --port <p> --enable-ssl --sender-name <n> --sender-address <addr> --account-password <p> --dry-run --json`, then `--yes`.
- "Send mail through our Microsoft 365 mailbox." → `blocks mail config save --name <n> --provider office365-smtp --entra-tenant-id <entraTenant> --client-id <appId> --client-secret <secret> --mailbox-address <addr> --sender-name <n> --sender-address <addr> --dry-run --json`, then `--yes`.
- "Show me the password-reset email template." → `blocks mail template list --search <query> --json`, then `blocks mail template get <itemId> --json`.
- "Clone this template into a new language." → `blocks mail template clone <itemId> --language <code> --name <n> --dry-run --json`.
- "What mail was sent out last week?" → `blocks mail mailbox list --start-date <date> --end-date <date> --json`.
- "How do I edit an email template from my app's code?" → not supported; template CRUD is CLI-only (`blocks mail template save`), no SDK path.
