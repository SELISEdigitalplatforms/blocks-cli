---
name: blocks-secrets
description: "Manage a SELISE Blocks project's secret store through the blocks CLI ('secrets list/get/set/set-many/update/rotate/lock/unlock/delete/restore/access/audit'): create named secrets from a file, env var or dotenv, rotate, lock, soft-delete/restore, set who may read them, and read the audit trail. The CLI never prints a secret value. CLI-only, project-scoped. Use for 'store an API key', 'rotate a secret', 'who can read this secret', 'show the secret audit log'."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Secrets

This skill covers the project's **secret store**: one record per named secret, with a status (`active`, `locked`, `deleted`), an optional access list (user ids and roles allowed to read the value), a rotation history and a full audit trail.

**The CLI never shows a secret value.** There is no command that prints one: `get`, `list` and `audit` return metadata only, dry-run output redacts values, and the only way a value enters the store is through `set`, `set-many` or `rotate`. If the user needs to *read* a value, that happens in the Blocks portal, not through the CLI or an agent.

**CLI-only, no SDK path.** There is no `@seliseblocks/client` namespace for the secret store. **Prerequisite:** a project is selected (`blocks use <tenantId>`); every command runs on an impersonated project token. If login/project state is unknown, run the blocks-bootstrap skill first.

## Command map

| Command | Notes |
|---|---|
| `blocks secrets list [--search s] [--status active\|locked\|deleted] [--include-deleted] [--organization-id id] [--page n] [--page-size n]` | Metadata pages `{data, totalCount}`. Never a value. Read-only. |
| `blocks secrets get <secretId>` | Metadata of one secret, including `access` and `canReadValue`. Read-only. |
| `blocks secrets set <name> --value-file p \| --value-env NAME \| --value text [--description] [--user-ids a,b] [--roles a,b]` | **Always creates** and returns `{secretId}`. Mutating. |
| `blocks secrets set-many --env-file <dotenv> [--description]` | One secret per `KEY=value` line, named after the key; returns `{secretIds: {name: id}}`. Mutating. |
| `blocks secrets update <secretId> [--name] [--description]` | Metadata only. Mutating. |
| `blocks secrets rotate <secretId> --value-file p \| --value-env NAME \| --value text` | Replaces the value in place; id, access list and audit stay. Mutating. |
| `blocks secrets lock\|unlock <secretId>` | Locked secrets refuse value reads and rotation. Mutating. |
| `blocks secrets delete\|restore <secretId>` | Delete is **soft**; restore undoes it. Mutating. |
| `blocks secrets access <secretId> [--user-ids a,b] [--roles a,b] [--merge] [--clear]` | Who may read the value. Replaces by default; `--merge` adds; `--clear` removes the restriction. Mutating. |
| `blocks secrets audit [<secretId>] [--action a] [--actor-user-id id] [--from iso] [--to iso] [--page] [--page-size]` | Every set, read, rotation, lock, delete, access change and denial, with actor and outcome. Read-only. |

Every secret the CLI creates is of the default type; there is no flag to choose another.

## Creating and rotating — keep values out of shell history

`set` and `rotate` take the value from exactly one source. Prefer the first two:

```bash
printf '%s' "$API_KEY" > ./key.txt
blocks secrets set stripe-api-key --value-file ./key.txt --description "Stripe live key" --dry-run --json
blocks secrets set stripe-api-key --value-file ./key.txt --description "Stripe live key" --yes --json
# -> {"secretId": "..."}  keep this id: it is how every other command addresses the secret

blocks secrets set stripe-api-key --value-env STRIPE_KEY --yes --json      # value read from the environment
blocks secrets rotate <secretId> --value-file ./new-key.txt --yes --json   # same id, new value
```

`--value <text>` works but lands in shell history and process listings; use it only when the other two are impossible. Dry-run output redacts the value (`"value": "***"`). Do not read the file or the variable back yourself — the point of the file/env sources is that the value never has to appear in a transcript.

**`set` never updates.** Names are not unique, so calling `set` twice with the same name creates two secrets. To change an existing secret's value use `rotate`; for its name or description use `update`. When the user says "update the secret", ask which they mean if it is not obvious — or check `secrets list --search <name>` first to see whether one already exists.

Bulk from a dotenv file:

```bash
blocks secrets set-many --env-file ./service.env --dry-run --json   # names + count, values redacted
blocks secrets set-many --env-file ./service.env --yes --json       # {"secretIds": {"DB_PASSWORD": "...", ...}}
```

## Access lists

```bash
blocks secrets access <secretId> --roles admin,devops --yes --json          # REPLACE the list with these roles
blocks secrets access <secretId> --user-ids <userId> --merge --yes --json   # ADD to whatever is there
blocks secrets access <secretId> --clear --yes --json                       # remove the per-secret restriction
```

The server replaces the list on every call, which is why the CLI defaults to replace and makes `--merge` explicit. Check the current list with `secrets get` (its `access` field) before replacing. The access list governs who may read the value in the portal or from services; it changes nothing about the CLI, which never reads values.

## `--dry-run` before `--yes` — always

Every mutating command follows the standard `blocks` discipline: `--dry-run` prints the request (values redacted) without calling the API; `--yes` skips the confirmation prompt. Omitting both drops into an interactive "Type 'yes' to continue" prompt, which hangs in a non-interactive run — always pass one or the other.

## Gotchas

- **No value read.** If asked "what is the value of secret X", the answer is that the CLI cannot show it; point the user to the portal. Do not try to work around this.
- **Soft delete.** `secrets delete` keeps the vault value and marks the record deleted; `secrets list --include-deleted` still shows it and `secrets restore` brings it back. There is no hard delete from the CLI.
- **Locked means frozen.** Locking refuses value reads and rotations for everyone until `unlock`; `rotate` on a locked secret fails with `409 invalid_state`.
- **Impersonated project token only.** A project must be selected first (`blocks use <tenantId>`).

## Example trigger prompts

- "Store this API key as a secret." → `secrets set <name> --value-file ...` (dry-run first, keep the returned `secretId`).
- "Rotate the payment gateway secret." → find it with `secrets list --search`, then `secrets rotate <id> --value-file ...`.
- "Who can read the database password secret?" → `secrets get <id>` and read `access`.
- "Let the devops role read it too." → `secrets access <id> --roles devops --merge`.
- "Show me who accessed this secret last week." → `secrets audit <id> --from <iso> --to <iso>`.
- "Import these .env values as secrets." → `secrets set-many --env-file .env` (dry-run first).
- "What is the value of this secret?" → not available from the CLI; the user reads it in the portal.
