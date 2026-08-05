---
name: blocks-notification
description: "Manage SELISE Blocks notification-channel configuration via `blocks notification *` — no SDK path exists (`@seliseblocks/client` has no `notification` namespace, only the unrelated real-time `notifier` surface). Covers `notification list`/`get` (read configs) and `notification save`/`delete` (project-scoped mutations, impersonated-project-token only). Use for 'list/get notification configs', 'save/update a channel', 'delete a config'. Always `--dry-run` before `--yes` on save/delete."
---

# Blocks Notification — Channel Configuration

Manage notification-channel configuration through `blocks notification *`. This is **100% CLI, no SDK equivalent** — `@seliseblocks/client` has no `notification` namespace at all. It does have a `notifier` namespace (backing `blocks notifier *`), but that's a **different, unrelated surface**: `notifier` pushes real-time/offline notifications and reads a user's own inbox; `notification` (this skill) manages the tenant's notification *channel configuration* — which channel/method a notification type uses, not sending one. Never write a frontend/app-code path for channel configuration — it's always this CLI.

**Prerequisite:** a project is selected (`blocks use <tenantId>`, or pass `--project <tenantId>`) — see the blocks-onboarding skill. Every one of the four commands requires an impersonated project session; there is no account-level mode for any of them.

## Safe read commands

- **`blocks notification list [--page <n>] [--page-size <n>] [--sort-by <property>] [--sort-desc] [--filter <text>] [--json]`** — read-only.
- **`blocks notification get <itemId> [--json]`** — `itemId` may be given positionally or as `--id <itemId>`; one of the two is required (the command throws `Missing --id` if neither is given). Read-only.

Neither read command mutates anything and neither accepts `--dry-run` (there's nothing to preview — no request body is built, no confirmation gate exists for either).

## Mutating: save (create or update a channel config)

```bash
blocks notification save --name <n> --channel <0|1> --type <0-3> --dry-run --json   # preview first
blocks notification save --name <n> --channel <0|1> --type <0-3> --yes --json        # only after approval
blocks notification save --update --body '<json>' --yes --json                       # full custom payload
```

The request body is built by merging (in this order, later keys win) whatever `--body '<json>'` or `--file <path.json>` supplies, then these convenience flags layered on top (so an unset convenience flag never overwrites a value from `--body`/`--file`):

| Flag | Body field | Notes |
|---|---|---|
| `--channel <int>` | `channelToNotify` | Raw integer — the CLI does **not** validate or enum-check the value itself. |
| `--type <int>` | `notificationType` | Same — raw integer, no validation in the command. |
| `--enable-persistence` | `enablePersistence` | Boolean flag; only ever sent as `true` when passed — passing it absent never sends an explicit `false`. |
| `--update` | `isUpdateRequest` | Same true-only pattern as `--enable-persistence`. Set this when saving over an existing config rather than creating a new one. |
| `--name <text>` | `name` | |
| `--notify-method <text>` | `notifyMethod` | |

`--dry-run` prints the resolved request and returns — no network call, no confirmation prompt. Without `--dry-run`, it prompts interactively for a typed `yes` before sending (unless `--yes` is also passed); only then does it resolve the selected project and issue the request. Always show `--dry-run` output and get explicit approval before re-running with `--yes`.

`--channel`/`--type` don't have machine-readable names published by the API; the CLI's own usage docs note they correspond to the OS API's channel/receiver-type enums (`--channel` roughly `0|1`, `--type` roughly `0-3`) — treat those ranges as documentation convention, not something this command enforces, and ask the user for the exact intended value rather than guessing one.

## Mutating: delete

```bash
blocks notification delete <itemId> --dry-run --json
blocks notification delete <itemId> --yes --json
```

Same `itemId` resolution as `get` — positional arg or `--id`, one required. `--dry-run` prints the resolved query and returns; otherwise it goes through the same confirmation gate as `save` (interactive `yes` prompt unless `--yes` is passed) before resolving the project and sending the request.

## Gotchas

- **No SDK path, ever.** If asked "how do I manage notification channels from my app," the answer is: you don't — this is CLI-only, human/CI-operated configuration, not something to wire into frontend or backend app code.
- **`notification` and `notifier` are not the same thing.** `notification save/list/get/delete` (this skill) configures *which channel/method* a notification type uses. `notifier notify/list/unread/mark-read/mark-all-read` *sends* notifications and reads a user's inbox — a separate command family with its own commands, not covered here. Don't answer a "send a notification" request with `notification save`, and don't answer a "configure the notification channel" request with `notifier`.
- **`list` and `get` have no `--dry-run`.** Only `save` and `delete` build a request that's worth previewing; the two read commands hit the API directly. Don't tell a user to `--dry-run` a `list` or `get` call.
- **`--enable-persistence` and `--update` are true-only flags.** Passing them sets the field to `true`; not passing them omits the field entirely (never sends an explicit `false`). If a user wants to explicitly *unset* persistence or force a plain create, that has to go through `--body`/`--file` directly, not the convenience flag.
- **`--channel`/`--type` are unvalidated raw integers.** The command will happily send any integer you give it — there's no local check against the underlying enums. Confirm the intended value with the user (or check the Blocks portal/API docs) rather than inventing one.
- **`itemId` for `get`/`delete` is always required**, positional or `--id` — never guessed. Ask the user rather than assuming a value.
- **Every command is project-scoped.** All four require a resolved project and an impersonated project token; behavior follows whichever project is currently selected via `blocks use` (or an explicit `--project` override).
- **`--dry-run` before `--yes`, always**, on `save` and `delete` — same discipline as every other mutating `blocks` command in this pack.

## Example trigger prompts

- "List the notification channel configs for this project."
- "Get notification config `<itemId>`."
- "Save a new notification config named `<name>` on channel 0, type 1." → preview with `--dry-run` first.
- "Update the existing `<name>` notification config." → add `--update`, still `--dry-run` before `--yes`.
- "Delete notification config `<itemId>`."
- "Send a notification to these users" / "show me a user's unread notifications" → not this skill; that's `blocks notifier *`, a different command family for sending/reading, not channel configuration.
