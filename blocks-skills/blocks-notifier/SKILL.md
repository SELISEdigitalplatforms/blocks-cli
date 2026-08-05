---
name: blocks-notifier
description: "Push real-time/offline notifications and manage a signed-in user's own notification inbox, via both the SDK (`blocksClient.notifier.*`) and the CLI (`blocks notifier notify|list|unread|mark-read|mark-all-read`). Distinct from the sibling blocks-notification skill, which configures tenant notification-*channel* settings on a different backing service, not sending. `notifier unread` flattens its subscription filter into GET query params since Fetch forbids a GET body. `--dry-run` before `--yes` on CLI `notify`/`mark-read`/`mark-all-read`."
---

# Blocks Notifier — Send & Inbox

`notifier` pushes real-time/offline notifications to users, roles, or subscription-filter matches, and reads/manages the signed-in user's own notification inbox. This is a **separate, deliberate concern from the blocks-notification skill**, which manages a tenant's notification-*channel configuration* — which channel/method a notification type uses — on an unrelated backing service. Both this skill and the sibling skill confirm the same distinction from their own side. Don't merge them, and don't reconcile them as if one were a typo for the other — they hit different backing services. If the ask is "configure which channel a notification type uses," route to the blocks-notification skill instead.

Unlike `blocks-notification` (100% CLI, no SDK path), **`notifier` has both a CLI and an SDK surface**, and every one of the five operations exists on both:

| Operation | CLI | SDK (`blocksClient.notifier.*`) |
|---|---|---|
| Send a notification | `blocks notifier notify` | `notify(request)` |
| List the inbox | `blocks notifier list` | `getNotifications(options)` |
| Unread by subscription filter | `blocks notifier unread` | `getUnreadNotificationsBySubscriptionFilter(request)` |
| Mark one read | `blocks notifier mark-read <id>` | `markNotificationAsRead(request)` |
| Mark all read | `blocks notifier mark-all-read` | `markAllNotificationAsRead()` |

## CLI — `blocks notifier *`

Every CLI command is project-scoped: each requires an impersonated project session — there is no account-level mode for any of the five. Project resolution follows the same order as everywhere else in this CLI: `--project <tenantId>` flag, then the workspace's `blocks.json`, then the globally selected project from `blocks use <tenantId>`. See the blocks-onboarding skill if no project is selected yet.

- **`blocks notifier notify [--user-ids a,b] [--roles a,b] [--connection-id <id>] [--configuration-name <n>] [--subscription-filters '<json>'] [--denormalized-payload <text>] [--save-denormalized-payload-as-object] [--content-available] [--response-key <k>] [--response-value <v>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — target with at least one of `--user-ids`/`--roles`/`--subscription-filters`. `--user-ids` and `--roles` are comma-separated lists; `--subscription-filters` is a raw JSON array string (e.g. `[{"context":"orders","actionName":"created","value":"*"}]`, matching `BlocksNotifierSubscriptionFilter[]`). The body is built by merging `--body`/`--file` first, then layering the convenience flags on top — so an explicit convenience flag always wins over the same field in `--body`/`--file`, and an unset one never overwrites what `--body`/`--file` supplied. `--content-available` and `--save-denormalized-payload-as-object` are true-only booleans (absent when not passed, never an explicit `false`).
- **`blocks notifier list [--unread-only] [--page <n>] [--page-size <n>] [--sort-by <property>] [--sort-desc] [--filter <text>] [--json]`** — read-only.
- **`blocks notifier unread [--user-id <id>] [--context <c>] [--action-name <a>] [--value <v>] [--order-by <1|2>] [--json]`** — read-only. See "The GET-with-a-body quirk" below.
- **`blocks notifier mark-read <id> [--dry-run] [--yes] [--json]`** — `id` may be positional or `--id`; one of the two is required (`Missing --id` if neither given).
- **`blocks notifier mark-all-read [--dry-run] [--yes] [--json]`** — no body/arguments needed.

### The GET-with-a-body quirk (`unread`)

This operation is documented upstream as a read with a JSON request body, which the Fetch spec forbids sending on a plain GET-style read. Both the CLI and SDK work around it the same way: flatten the filter fields into the query string instead. Confirmed field names, read directly from source:

```
UserId
SubscriptionFilterData.Context
SubscriptionFilterData.ActionName
SubscriptionFilterData.Value
OrderBy
```

CLI flags map to them as `--user-id` -> `UserId`, `--context` -> `SubscriptionFilterData.Context`, `--action-name` -> `SubscriptionFilterData.ActionName`, `--value` -> `SubscriptionFilterData.Value`, `--order-by` -> `OrderBy` (an integer, `1|2` per the SDK type — its enum meaning isn't published anywhere, so treat it as opaque and confirm with the user rather than guessing which value means what).

This flattening is a **client-side inference, not something verified against a live call** — both the CLI and SDK made the same choice independently, which is corroborating but not proof the real backend accepts it. If a live `notifier unread` call ever errors, re-check this against the actual API response rather than assuming the flattening above is still correct.

## SDK — `blocksClient.notifier.*`

```ts
import { blocksClient } from "../../lib/blocks/client";

await blocksClient.notifier.notify({
  userIds: ["user-1"],
  roles: ["admin"],
  denormalizedPayload: '{"orderId":"123"}',
  saveDenormalizedPayloadAsAnObject: true
});

const inbox = await blocksClient.notifier.getNotifications({ isUnreadOnly: true, page: 1, pageSize: 20 });

const unread = await blocksClient.notifier.getUnreadNotificationsBySubscriptionFilter({
  userId: "user-1",
  subscriptionFilterData: { context: "orders", actionName: "created" }
});

await blocksClient.notifier.markNotificationAsRead({ id: notificationId });
await blocksClient.notifier.markAllNotificationAsRead();
```

- **`notify(request: BlocksNotifyRequest)`** — fields: `configurationName?`, `connectionId?`, `contentAvailable?: boolean`, `denormalizedPayload?: string`, `responseKey?`, `responseValue?`, `roles?: string[]`, `saveDenormalizedPayloadAsAnObject?: boolean`, `subscriptionFilters?: BlocksNotifierSubscriptionFilter[]`, `userIds?: string[]`.
- **`getUnreadNotificationsBySubscriptionFilter(request)`** — fields: `orderBy?: 1 | 2` (opaque enum), `subscriptionFilterData?: { actionName?, context?, value? }`, `userId?`. Internally builds the same flattened query as the CLI (see above) — this is the SDK-side half of the same documented workaround.
- **`getNotifications(options: BlocksGetNotificationsOptions = {})`** — options: `filter?`, `isUnreadOnly?`, `page?`, `pageSize?`, `sortBy?`, `sortDescending?`. Response shape: `{ notifications: Record<string, unknown>[], totalNotificationsCount: number, unReadNotificationsCount: number }`.
- **`markAllNotificationAsRead()`** — no arguments.
- **`markNotificationAsRead(request: BlocksMarkNotificationAsReadRequest)`** — request: `{ id: string }`.

`BlocksOfflineNotification` (the shape of items `getUnreadNotificationsBySubscriptionFilter` resolves to) is a loose `Record<string, unknown>` plus known fields `correlationId?`, `createdTime?`, `denormalizedPayload?`, `id?`, `isRead?`, `payload?`, `readByRoles?: string[]`, `readByUserIds?: string[]`. `BlocksNotifierPassThroughResponse` (the `notify`/mark-read/mark-all-read return type) is an untyped `Record<string, unknown>` — the SDK doesn't shape it further; don't assume fields beyond what a live response actually contains.

The SDK methods don't take a project/tenant argument per call — project context comes from however the app's shared `blocksClient` instance was constructed (its `xBlocksKey`/`appDomain`), same as every other `blocksClient.*` namespace. Don't create a second client just for notifier calls.

## Mutation discipline (CLI only)

`notify`, `mark-read`, and `mark-all-read` are the three CLI mutations, and all three follow the same two-gate pattern used throughout this CLI:

1. **`--dry-run`** short-circuits before any network call or confirmation prompt, printing a preview of what would be sent (`mark-all-read`'s preview has no request body since it sends none).
2. Without `--dry-run`, a confirmation step accepts `--yes` outright or, interactively, prompts to type "yes" to continue, and cancels on anything else.

Always show the `--dry-run` output and get explicit approval before re-running with `--yes`. `list` and `unread` are read-only and have neither flag — don't tell a user to `--dry-run` a `list` or `unread` call. The SDK methods have no equivalent gate at all; that discipline is a CLI-only convention for terminal/CI operators, not something app code needs to replicate.

## Gotchas

- **`notifier` and `notification` are not the same thing, and this is not an oversight to fix.** `notifier` (this skill) sends notifications and reads a user's inbox, on both CLI and SDK. `notification` (the sibling skill) configures a tenant's notification channel settings, CLI-only. Don't answer a "send a notification" ask with `notification save`, and don't answer a "configure the channel" ask with `notifier`.
- **`notifier unread`'s query-param flattening is an inferred client-side workaround for a Fetch-spec conflict, not verified against a live call.** See "The GET-with-a-body quirk" above. If it ever errors in practice, re-check whether the real endpoint tolerates a body server-side (some non-browser/non-Node HTTP stacks do) before assuming the flattening itself is broken.
- **`--content-available` and `--save-denormalized-payload-as-object` on `notify` are true-only flags.** Passing them sends `true`; omitting them omits the field entirely — there's no way to send an explicit `false` through the convenience flags (use `--body`/`--file` for that).
- **Convenience flags on `notify` win over `--body`/`--file`.** The merge order is `--body`/`--file` first, then the individual flags spread on top — so a flag like `--connection-id` always overrides the same key in `--body` if both are given.
- **`order-by` (both CLI `--order-by` and SDK `orderBy`) is an opaque `1|2` enum** — its meaning isn't published anywhere. Ask the user or confirm from the live API rather than guessing which value sorts which way.
- **Every CLI command is project-scoped**; there's no account-level mode. The SDK has no per-call project argument — it inherits whatever project the shared `blocksClient` was configured for.
- **`mark-read`'s `id` (positional or `--id`) is always required** — never guessed or defaulted.
- **`--dry-run` before `--yes`, always**, on the three CLI mutations — same discipline as every other mutating `blocks` command in this pack.

## Example trigger prompts

- "Send a notification to these user IDs from my app." -> SDK `blocksClient.notifier.notify({ userIds: [...] })`.
- "Push a notification to everyone matching this subscription filter." -> SDK `notify({ subscriptionFilters: [...] })`, or `blocks notifier notify --subscription-filters '<json>' --dry-run --json` from the terminal.
- "Show me a user's unread notifications for the 'orders' context." -> `blocks notifier unread --user-id <id> --context orders --json`, or SDK `getUnreadNotificationsBySubscriptionFilter({ userId, subscriptionFilterData: { context: "orders" } })`.
- "List my notification inbox, unread only." -> `blocks notifier list --unread-only --json`, or SDK `getNotifications({ isUnreadOnly: true })`.
- "Mark this notification as read." -> `blocks notifier mark-read <id> --dry-run --json`, then `--yes`.
- "Mark everything in the inbox as read." -> `blocks notifier mark-all-read --dry-run --json`, then `--yes`.
- "Configure which channel the order-shipped notification uses." -> not this skill; that's the blocks-notification skill.
