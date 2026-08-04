---
name: blocks-notifier
description: "Push real-time/offline notifications and manage a signed-in user's own notification inbox, via both the SDK (`blocksClient.notifier.*`) and the CLI (`blocks notifier notify|list|unread|mark-read|mark-all-read`), all hitting `/logic/v4/Notifier/*`. Distinct from the sibling `blocks-notification` skill, which configures tenant notification-*channel* settings (`/os/v4/Notification/*`) — a different backing service, not sending. `notifier unread` flattens its subscription filter into GET query params since Fetch forbids a GET body. `--dry-run` before `--yes` on CLI `notify`/`mark-read`/`mark-all-read`."
---

# Blocks Notifier — Send & Inbox

`notifier` pushes real-time/offline notifications to users, roles, or subscription-filter matches, and reads/manages the signed-in user's own notification inbox, through `/logic/v4/Notifier/*`. This is a **separate, deliberate concern from `blocks-notification`** (the sibling skill), which manages a tenant's notification-*channel configuration* — which channel/method a notification type uses — through the unrelated `/os/v4/Notification/*` OS-API surface. The split is confirmed in source: `blocks-client/src/notifier/notifier-client.ts` carries a class-doc comment explicitly distinguishing the two, and the sibling `blocks-notification` skill repeats the same distinction from its side. Don't merge them, and don't reconcile them as if one were a typo for the other — they hit different backing services. If the ask is "configure which channel a notification type uses," route to [blocks-notification](../blocks-notification/SKILL.md) instead.

Unlike `blocks-notification` (100% CLI, no SDK path), **`notifier` has both a CLI and an SDK surface**, and every one of the five operations exists on both:

| Operation | CLI | SDK (`blocksClient.notifier.*`) |
|---|---|---|
| Send a notification | `blocks notifier notify` | `notify(request)` |
| List the inbox | `blocks notifier list` | `getNotifications(options)` |
| Unread by subscription filter | `blocks notifier unread` | `getUnreadNotificationsBySubscriptionFilter(request)` |
| Mark one read | `blocks notifier mark-read <id>` | `markNotificationAsRead(request)` |
| Mark all read | `blocks notifier mark-all-read` | `markAllNotificationAsRead()` |

Source: `blocks-cli/src/commands/notifier/{notify,list,unread,mark-read,mark-all-read}.ts`, registered in `blocks-cli/src/index.ts` as `notifier:notify`/`notifier:list`/`notifier:unread`/`notifier:mark-read`/`notifier:mark-all-read`; and `blocks-client/src/notifier/{notifier-client,types}.ts`.

## CLI — `blocks notifier *`

Every CLI command is project-scoped: each resolves `selectedProject(flags)` and sends `impersonatedProjectAuth: true` — there is no account-level mode for any of the five. Project resolution follows the same order as everywhere else in this CLI: `--project <tenantId>` flag, then the workspace's `blocks.json`, then the globally selected project from `blocks use <tenantId>`. See [blocks-onboarding](../blocks-onboarding/SKILL.md) if no project is selected yet.

- **`blocks notifier notify [--user-ids a,b] [--roles a,b] [--connection-id <id>] [--configuration-name <n>] [--subscription-filters '<json>'] [--denormalized-payload <text>] [--save-denormalized-payload-as-object] [--content-available] [--response-key <k>] [--response-value <v>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — `POST /logic/v4/Notifier/Notify`. Target with at least one of `--user-ids`/`--roles`/`--subscription-filters`. `--user-ids` and `--roles` are comma-separated lists; `--subscription-filters` is a raw JSON array string (e.g. `[{"context":"orders","actionName":"created","value":"*"}]`, matching `BlocksNotifierSubscriptionFilter[]`). The body is built by merging `--body`/`--file` first, then layering the convenience flags on top via `compact(...)` — so an explicit convenience flag always wins over the same field in `--body`/`--file`, and an unset one never overwrites what `--body`/`--file` supplied. `--content-available` and `--save-denormalized-payload-as-object` are true-only booleans (absent when not passed, never an explicit `false`).
- **`blocks notifier list [--unread-only] [--page <n>] [--page-size <n>] [--sort-by <property>] [--sort-desc] [--filter <text>] [--json]`** — `GET /logic/v4/Notifier/GetNotifications`. Read-only. Query params sent: `Filter`, `IsUnreadOnly` (only sent if `--unread-only` is actually passed), `Page` (default `1`), `PageSize` (default `20`), `Sort.IsDescending` (only sent if `--sort-desc` is actually passed), `Sort.Property`.
- **`blocks notifier unread [--user-id <id>] [--context <c>] [--action-name <a>] [--value <v>] [--order-by <1|2>] [--json]`** — `GET /logic/v4/Notifier/GetUnreadNotificationsBySubscriptionFilter`. Read-only. See "The GET-with-a-body quirk" below for the exact query params.
- **`blocks notifier mark-read <id> [--dry-run] [--yes] [--json]`** — `POST /logic/v4/Notifier/MarkNotificationAsRead` (method is implicit-POST because a body is present; no explicit `method` in source). `id` may be positional or `--id`; one of the two is required (`Missing --id` if neither given). Body sent: `{ id }`.
- **`blocks notifier mark-all-read [--dry-run] [--yes] [--json]`** — `POST /logic/v4/Notifier/MarkAllNotificationAsRead`. No body; `method: "POST"` is set explicitly in source since there's nothing to infer POST from otherwise.

### The GET-with-a-body quirk (`unread`)

`GetUnreadNotificationsBySubscriptionFilter` is documented in swagger as a `GET` with a JSON request body, which the Fetch spec forbids sending on a `GET`. Both `blocks-cli/src/commands/notifier/unread.ts` and `blocks-client/src/notifier/notifier-client.ts` carry comments saying so, and both work around it the same way: flatten the filter fields into the query string instead. Confirmed exact query param names, read directly from both files:

```
UserId
SubscriptionFilterData.Context
SubscriptionFilterData.ActionName
SubscriptionFilterData.Value
OrderBy
```

CLI flags map to them as `--user-id` -> `UserId`, `--context` -> `SubscriptionFilterData.Context`, `--action-name` -> `SubscriptionFilterData.ActionName`, `--value` -> `SubscriptionFilterData.Value`, `--order-by` -> `OrderBy` (an integer, `1|2` per the SDK type — its enum meaning isn't published in the swagger contract the source was written against, so treat it as opaque and confirm with the user rather than guessing which value means what).

This flattening is a **client-side inference, not something verified against a live call** — both the CLI and SDK made the same choice independently (or one copied the other), which is corroborating but not proof the real backend accepts it. If a live `notifier unread` call ever errors (e.g. a 4xx suggesting the server actually wants a body, Fetch-spec objections notwithstanding, perhaps via a non-Fetch-based caller), re-check this against the actual API response rather than assuming the flattening above is still correct.

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

- **`notify(request: BlocksNotifyRequest)`** -> `Promise<BlocksNotifierPassThroughResponse>` via `POST /logic/v4/Notifier/Notify`. `BlocksNotifyRequest` fields (from `blocks-client/src/notifier/types.ts`): `configurationName?`, `connectionId?`, `contentAvailable?: boolean`, `denormalizedPayload?: string`, `responseKey?`, `responseValue?`, `roles?: string[]`, `saveDenormalizedPayloadAsAnObject?: boolean`, `subscriptionFilters?: BlocksNotifierSubscriptionFilter[]`, `userIds?: string[]`.
- **`getUnreadNotificationsBySubscriptionFilter(request)`** -> `Promise<BlocksOfflineNotification[]>` via `GET /logic/v4/Notifier/GetUnreadNotificationsBySubscriptionFilter`. `BlocksGetUnreadNotificationsBySubscriptionFilterRequest`: `orderBy?: 1 | 2` (opaque enum, per an inline comment in `types.ts`), `subscriptionFilterData?: { actionName?, context?, value? }`, `userId?`. Internally the SDK builds the same flattened query object as the CLI (see above) — this is the SDK-side half of the same documented workaround.
- **`getNotifications(options: BlocksGetNotificationsOptions = {})`** -> `Promise<BlocksGetNotificationsResponse>` via `GET /logic/v4/Notifier/GetNotifications`. Options: `filter?`, `isUnreadOnly?`, `page?`, `pageSize?`, `sortBy?`, `sortDescending?`. Response shape: `{ notifications: Record<string, unknown>[], totalNotificationsCount: number, unReadNotificationsCount: number }`.
- **`markAllNotificationAsRead()`** -> `Promise<BlocksNotifierPassThroughResponse>` via `POST /logic/v4/Notifier/MarkAllNotificationAsRead`. No arguments.
- **`markNotificationAsRead(request: BlocksMarkNotificationAsReadRequest)`** -> `Promise<BlocksNotifierPassThroughResponse>` via `POST /logic/v4/Notifier/MarkNotificationAsRead`. Request: `{ id: string }`.

`BlocksOfflineNotification` (the shape of items `getUnreadNotificationsBySubscriptionFilter` resolves to) is a loose `Record<string, unknown>` plus known fields `correlationId?`, `createdTime?`, `denormalizedPayload?`, `id?`, `isRead?`, `payload?`, `readByRoles?: string[]`, `readByUserIds?: string[]`. `BlocksNotifierPassThroughResponse` (the `notify`/mark-read/mark-all-read return type) is an untyped `Record<string, unknown>` — the SDK doesn't shape it further; don't assume fields beyond what a live response actually contains.

The SDK methods don't take a project/tenant argument per call — project context comes from however the app's shared `blocksClient` instance was constructed (its `xBlocksKey`/`appDomain`), same as every other `blocksClient.*` namespace. Don't create a second client just for notifier calls.

## Mutation discipline (CLI only)

`notify`, `mark-read`, and `mark-all-read` are the three CLI mutations, and all three follow the same two-gate pattern used throughout this CLI:

1. **`--dry-run`** short-circuits before any network call or confirmation prompt, printing `{ dryRun: true, endpoint, request }` (`mark-all-read`'s preview omits `request` since it sends no body).
2. Without `--dry-run`, **`confirmMutation`** accepts `--yes` outright or, interactively, prompts "...Type 'yes' to continue:" and throws `Cancelled.` on anything else.

Always show the `--dry-run` output and get explicit approval before re-running with `--yes`. `list` and `unread` are read-only and have neither flag in source — don't tell a user to `--dry-run` a `list` or `unread` call. The SDK methods have no equivalent gate at all; that discipline is a CLI-only convention for terminal/CI operators, not something app code needs to replicate.

## Gotchas

- **`notifier` and `notification` are not the same thing, and this is not an oversight to fix.** `notifier` (this skill) sends notifications and reads a user's inbox (`/logic/v4/Notifier/*`), on both CLI and SDK. `notification` (the sibling skill) configures a tenant's notification channel settings (`/os/v4/Notification/*`), CLI-only. Don't answer a "send a notification" ask with `notification save`, and don't answer a "configure the channel" ask with `notifier`.
- **`notifier unread`'s query-param flattening is an inferred client-side workaround for a Fetch-spec conflict, not verified against a live call.** See "The GET-with-a-body quirk" above. If it ever errors in practice, re-check whether the real endpoint tolerates a GET body server-side (some non-browser/non-Node HTTP stacks do) before assuming the flattening itself is broken.
- **`--content-available` and `--save-denormalized-payload-as-object` on `notify` are true-only flags.** Passing them sends `true`; omitting them omits the field entirely — there's no way to send an explicit `false` through the convenience flags (use `--body`/`--file` for that).
- **Convenience flags on `notify` win over `--body`/`--file`.** The merge order in source is `--body`/`--file` first, then the individual flags spread on top — so a flag like `--connection-id` always overrides the same key in `--body` if both are given.
- **`order-by` (both CLI `--order-by` and SDK `orderBy`) is an opaque `1|2` enum** — its meaning isn't published in the swagger contract the source was written against. Ask the user or confirm from the live API rather than guessing which value sorts which way.
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
- "Configure which channel the order-shipped notification uses." -> not this skill; that's [blocks-notification](../blocks-notification/SKILL.md).
