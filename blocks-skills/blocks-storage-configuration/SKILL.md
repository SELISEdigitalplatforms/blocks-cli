---
name: blocks-storage-configuration
description: "Configure which storage provider (Azure Blob, S3, or local disk) backs a SELISE Blocks project's files: named configurations with host, port, credentials, region/endpoint or connection string, and strategy, via the blocks CLI ('storage config get/list/save/delete'), project-scoped with an impersonated project token. CLI-only admin surface, no SDK equivalent. Use for set up a storage provider, list/inspect storage configs, rotate storage credentials, switch to local storage, delete a config. Uploading/downloading files once configured is blocks-data-storage's job."
---

# Blocks Storage — Configuration

This skill manages the **storage configuration record itself** — which cloud provider (or local disk) a named configuration points at, and the connection details needed to reach it. It does not upload, download, or browse files; that's a separate, project-scoped runtime concern handled by the sibling blocks-data-storage skill (`blocks data files *` CLI, or the SDK's `data.files`/`data.dms` at runtime).

**CLI-only, no SDK path.** There is no `@seliseblocks/client` method for reading or writing a storage configuration's own fields — the SDK's role in this area starts *after* a configuration exists (it takes a `configurationName` and uploads/downloads against whatever that config points at). If a user wants to set up, inspect, or change a storage provider, that's this skill's `blocks storage config *` commands; if they want to move bytes, hand off to blocks-data-storage.

**Prerequisite:** a project is selected (`blocks use <tenantId>`). If login/project state is unknown, run the blocks-onboarding skill first.

## Command family

All four commands require an **impersonated project token** — there is no account-token path for this surface, consistent with other project-scoped admin commands (`secrets *`, `data config *`, etc.).

| Command | Notes |
|---|---|
| `blocks storage config list` | No parameters beyond the selected project. Read-only. |
| `blocks storage config get <name>` | `<name>` (positional) or `--name` (required if no positional arg). Read-only. |
| `blocks storage config save` | Upsert — create or update a configuration. Mutating. |
| `blocks storage config delete <name>` | `<name>` (positional) or `--name` (required if no positional arg). Mutating. |

```bash
blocks storage config list --json
blocks storage config get Default --json
blocks storage config get --name Default --json
```

## `storage config save` — fields

`save` builds its request body from `--body`/`--file` (a raw JSON object, spread first) merged with these convenience flags (later, so they win if both are given):

| Flag | Body field |
|---|---|
| `--name` | `name` |
| `--item-id` | `itemId` |
| `--strategy` | `storageStrategy` |
| `--host` | `host` |
| `--port` | `port` |
| `--region-endpoint` | `cloudStorageRegionEndPoint` |
| `--connection-string` | `connectionString` |
| `--access-key` | `accessKey` |
| `--secret-key` | `secretKey` |
| `--username` | `userName` |
| `--password` | `password` |
| `--remote-base-path` | `remoteBasePath` |
| `--update` (boolean) | `updateRequest` |

Unset flags are dropped (`compact`), so they never overwrite fields already present in a `--body`/`--file` payload. `save` is a create-or-update in one command, not two separate verbs — pass `--item-id` (and typically `--update`) when modifying an existing configuration, omit it to create a new one.

```bash
blocks storage config save --name Default --strategy AzureBlob \
  --host mystorageaccount.blob.core.windows.net --region-endpoint eu-west-1 \
  --access-key <key> --secret-key <secret> --dry-run --json
blocks storage config save --name Default --strategy AzureBlob \
  --host mystorageaccount.blob.core.windows.net --region-endpoint eu-west-1 \
  --access-key <key> --secret-key <secret> --yes --json

# Update an existing configuration
blocks storage config save --item-id <id> --update --connection-string "<new connection string>" --dry-run --json
blocks storage config save --item-id <id> --update --connection-string "<new connection string>" --yes --json
```

## `--dry-run` before `--yes` — always

Both mutating commands (`save`, `delete`) follow the standard `blocks` mutation discipline: `--dry-run` prints what would be sent and returns without calling the API; `--yes` skips the interactive confirmation prompt and sends the request for real. Omitting both drops into an interactive "Type 'yes' to continue" prompt — not viable in a scripted/agent context, so always pass one or the other explicitly.

```bash
blocks storage config delete Default --dry-run --json
blocks storage config delete Default --yes --json
```

`save`'s dry-run output redacts secret-shaped fields before printing (`accessKey`, `connectionString`, `password`, `secretKey` become `"***"`) — this redaction is **dry-run-preview only**, it does not change what's actually sent when you run with `--yes`, and it doesn't apply to `get`/`list` responses (see Gotchas).

## Gotchas

- **`get`/`list` are not redacted.** Only `save --dry-run`'s own preview output redacts `accessKey`/`connectionString`/`password`/`secretKey`. If a `get`/`list` response ever echoes credential fields back, treat that output as sensitive — don't paste it into logs, tickets, or chat verbatim.
- **`save` is upsert, not separate create/update commands.** Whether a call creates or updates is determined by whether `--item-id` is present, not by a different command name.
- **This is provider configuration, not file operations.** `blocks storage config *` never touches an actual file's bytes. For "upload a file," "get a download link," "list a folder" — that's **blocks-data-storage** (`blocks data files *` or the SDK), using a `configurationName` that a `storage config` record already defines.
- **No positional-or-flag ambiguity trap:** `get`/`delete` accept the configuration name as either the first positional argument or `--name`; only one is required, not both.
- **Impersonated project token only.** Like `secrets *` and `data config *`, none of these four commands run against the account token — a project must be selected first (`blocks use <tenantId>`).

## Example trigger prompts

- "Set up Azure Blob storage for this project." → `storage config save --strategy AzureBlob ...`.
- "What storage configurations exist on this project?" → `storage config list`.
- "Show me the `Default` storage configuration." → `storage config get Default`.
- "Rotate the access key on our storage config." → `storage config save --item-id <id> --update --access-key <new key> ...`.
- "Switch this project to local storage." → `storage config save --strategy <local strategy value> --host ... --port ...` (confirm the exact strategy value expected by the project rather than guessing).
- "Delete this storage configuration, we don't use it anymore." → `storage config delete <name>`.
- "How do I actually upload a file once storage is configured?" → hand off to **blocks-data-storage**, not this skill.
