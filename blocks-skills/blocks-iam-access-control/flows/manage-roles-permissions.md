# Flow: Creating/editing roles & permissions (sensitive)

This is the write side, and it's legitimate **only in direct response to a human's explicit, in-the-moment instruction** — either that human running `blocks iam roles/permissions create|update|assign-permissions` themselves (with a `--dry-run` reviewed first), or a signed-in admin operating their own in-app admin screen. Never something an agent decides to invoke on its own initiative.

## CLI command reference

All project-scoped — every command resolves the active project (`blocks use <tenantId>` or an explicit `--project <tenantId>`) and runs on an impersonated project token, not the account token `iam me` uses.

```
blocks iam roles list [--page] [--page-size] [--search] [--slugs a,b] [--organization-id] [--filter '<json>'] [--json]
blocks iam roles get <id> [--json]
blocks iam roles create --name <n> [--slug] [--description] [--parent-role-slug] [--can-create-own] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
blocks iam roles update <itemId> [--name] [--description] [--parent-role-slug] [--propagate-to-other-org] [--can-create-own] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
blocks iam roles assign-permissions <slug> [--add-permissions a,b] [--remove-permissions a,b] [--organization-id] [--dry-run] [--yes] [--json]
blocks iam roles assignable [--json]

blocks iam permissions list [--page] [--page-size] [--search] [--type <0-3>] [--severity <0-4>] [--resource-group] [--tags a,b] [--resources a,b] [--is-built-in] [--is-archived] [--roles a,b] [--organization-id] [--filter '<json>'] [--json]
blocks iam permissions get <id> [--json]
blocks iam permissions create --name <n> [--type] [--description] [--resource] [--resource-group] [--tags a,b] [--severity] [--is-built-in] [--dependent-permissions a,b] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
blocks iam permissions update <id> [same flags as create, plus --is-archived] [--dry-run] [--yes] [--json]
blocks iam permissions by-severity [--json]
```

Mutating commands (`create`, `update`, `assign-permissions`) follow the same discipline as every other mutating command in this CLI: pass `--dry-run` first to see the exact request body and endpoint with no network call, then re-run with `--yes` (or you'll be prompted to confirm) to actually send it.

## Two equally real surfaces

The choice is about *where the human is*, not which one is "allowed":

- **`blocks iam roles/permissions *` from a terminal** — a human (or an agent acting on that human's explicit, in-the-moment instruction) runs the CLI directly. `--dry-run` is the CLI's own review step; treat a clean dry-run plus the human's go-ahead as the confirmation, then run with `--yes`.
- **`blocksClient.iam.roles`/`iam.permissions` from inside an app** — for building an admin settings screen. If you're building that user their own admin screen, and *they* click "Create role" through that screen, calling `iam.roles.create()` from the app's code is exactly what the SDK method is for.

The actual line is not "CLI vs SDK" — it's:

- **Fine:** a command run because a human just asked for this specific change (terminal or in-app), bounded by that human's own IAM permissions.
- **Not fine:** an agent deciding on its own to call `create`/`update`/`assignPermissions` (CLI or SDK) — whether to "help out," to fix something it noticed, or as part of a larger task the user didn't ask it to take this specific action for.

## SDK methods (write side)

All from `blocksClient.iam`, per `iam-client.ts`:

- `permissions.create(request)` / `permissions.update(id, request)` — define or edit a permission.
- `permissions.list(request)` — paged/filtered search.
- `permissions.bySeverity()` — permissions grouped by severity, handy for a categorized picker.
- `permissions.get(id)` — one permission's detail.
- `roles.create(request)` / `roles.update(request)` — define or edit a role.
- `roles.list(request)` / `roles.get(id)` — search / fetch one role.
- `roles.assignPermissions(request)` — attach/detach permissions on a role.
- `roles.assignable()` — same read method as feature-gating; also useful here to limit which roles this admin's screen lets them touch at all.
- `resources.groups()` — metadata for grouping permissions by resource in the UI (e.g. a permissions picker organized by resource/module).

The SDK deliberately leaves these request bodies as open `Record<string, unknown>` rather than locking you to a fixed shape — confirm exact field names against the portal or a `list()`/`get()` response before hardcoding new ones. Two fields the SDK's own types do pin down: a role's `slug` (`BlocksRole.slug`) is its stable key — use it, not `itemId`, anywhere the API expects a role reference (e.g. `assignPermissions`); a permission's `resource` and `roles[]` (`BlocksPermission`) tell you what it's scoped to and which roles already hold it.

## Confirm before mutating

**Before calling any of `permissions.create`, `permissions.update`, `roles.create`, `roles.update`, or `roles.assignPermissions` from your admin screen's code, the screen itself must get an explicit, in-the-moment confirmation from the admin operating it** — mirror the discipline `blocks iam roles/permissions create|update|assign-permissions` enforces natively with `--dry-run` before `--yes`. Concretely, that means the screen should:

1. Let the admin build up the change in the UI (pick a role, check/uncheck permissions, edit a name) without calling anything yet.
2. Show a clear summary of exactly what will change — "Grant `Editor` role: + `content::publish`, − `content::archive`" — before any network call.
3. Only fire the `create`/`update`/`assignPermissions` call after the admin clicks an explicit confirm ("Save changes", "Create role") for *that specific* change.

Don't collapse steps 2–3 into an auto-save on every checkbox click, and don't have an agent call these methods proactively (e.g. as part of "let me clean up your roles" or "I'll just add the permission you mentioned needing") — only in direct response to the human's own confirmed action through the screen.

## Examples

SDK, wired to a confirm step:

```tsx
// src/features/admin/roles/useAssignPermissions.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { blocksClient } from "../../../lib/blocks/client";

export function useAssignPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (delta: { slug: string; addPermissions: string[]; removePermissions: string[] }) =>
      blocksClient.iam.roles.assignPermissions(delta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["iam", "roles"] })
  });
}
```

```tsx
// in the role editor component, only after the admin reviews a diff and clicks "Save":
const assign = useAssignPermissions();
const onConfirmSave = () =>
  assign.mutate({ slug: role.slug, addPermissions: pendingAdds, removePermissions: pendingRemoves });
```

The equivalent from a terminal, doing the same review-then-confirm dance the CLI enforces natively:

```
blocks use my-tenant-id                      # or pass --project my-tenant-id on every call below
blocks iam roles create --name Editor --description "Content editors" --dry-run
# review the printed request body, then:
blocks iam roles create --name Editor --description "Content editors" --yes

blocks iam roles assign-permissions editor --add-permissions content::publish --dry-run
blocks iam roles assign-permissions editor --add-permissions content::publish --yes
```

## Gotchas

- **CLI mutations are project-scoped, not account-scoped** — `blocks iam roles create/update/assign-permissions` and `blocks iam permissions create/update` all require a selected project (`blocks use <tenantId>` or `--project <tenantId>`) and run against the impersonated-project token; `blocks iam me` is the one IAM command that uses the account token instead, so don't expect `iam me`'s auth context to carry over to these.
- **Role hierarchy and permission assignment key off `slug`**, not `itemId` — grab it from `roles.list()`/`roles.get()` (or `blocks iam roles list/get`) before calling `assignPermissions`.
- **Permission assignment ultimately uses permission `itemId`s** — the CLI resolves `resource` strings like `content::publish` before mutation; SDK/backend callers should pass permission ids directly in `addPermissions` / `removePermissions`.
- **`roles.assignPermissions` is additive/subtractive** (`addPermissions[]` / `removePermissions[]` in one call), not a full-set replace — compute the delta from what's checked/unchecked, don't resend the entire permission list as "adds."
- **`roles.assignable()` scopes to the caller** — always populate role pickers from it rather than `roles.list()`, so an admin can't be shown (or attempt to grant) a role above their own authority.
- **Never fire a create/update/assign-permissions call — CLI or SDK — without a human confirming that specific change first** (a reviewed `--dry-run` plus explicit go-ahead on the CLI, an explicit in-UI confirm for the SDK) — no auto-provisioning "default roles," no agent-initiated cleanup of permissions, no batch edits without a per-change confirm.
- **OIDC/identity-provider client provisioning is always portal-only**, independent of everything above — if a request drifts into "create an OIDC client" or "add an identity provider," that's a different skill's territory (or no skill's — send the user to the portal), not something to bolt onto this one.
