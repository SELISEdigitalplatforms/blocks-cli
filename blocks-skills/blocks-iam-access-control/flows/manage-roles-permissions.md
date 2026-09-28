# Flow: Creating/editing roles & permissions (sensitive)

This is the write side, and it's legitimate **only in direct response to a human's explicit, in-the-moment instruction** — either that human running `blocks iam roles/permissions create|update|assign-permissions` themselves (with a `--dry-run` reviewed first), or a signed-in admin operating their own in-app admin screen. Never something an agent decides to invoke on its own initiative.

## CLI command reference

All project-scoped — every command resolves the active project (`blocks use <tenantId>` or an explicit `--project <tenantId>`) and runs on an impersonated project token. `iam me` also prefers that token when a project resolves, but can fall back to account auth when none does.

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

`--type` and `--severity` are IAM enums passed as raw integers, and severity is ordered **most severe first**, which is the opposite of what the number suggests:

| `--type` (ResourceType) | | `--severity` (PermissionSeverity) | |
|---|---|---|---|
| `0` | None (unset) | `0` | None — unset, treated as the lowest tier |
| `1` | Endpoint — checked by the API gateway | `1` | **Critical** — can compromise the tenant |
| `2` | FrontendAction — checked by the SPA's permission gate | `2` | High — exposes customer data or broad read access |
| `3` | DataProtection — field/record encryption or masking rule | `3` | Medium — routine admin, limited blast radius |
| | | `4` | Low — cosmetic or read-only |

So `--severity 1` filters for the *most* dangerous permissions, not the least. Severity drives approval workflows (high-severity grants need an extra approver), UI emphasis, and audit-alert priority — it is not decorative.

`roles update` reads the role first and merges your flags over it -- the endpoint replaces the role, so an unmerged rename would clear the description, detach the parent and turn `canCreateOwn` off. Omitting a flag keeps the stored value; pass it explicitly to clear it.

Mutating commands (`create`, `update`, `assign-permissions`) follow the same discipline as every other mutating command in this CLI: pass `--dry-run` first to see the exact request body and endpoint with no network call, then re-run with `--yes` (or you'll be prompted to confirm) to actually send it.

## Built-in permissions are assignable — every one of them

**Rule: any permission held by the seeded `clouduser` system user can be assigned to any role. There is no restricted subset.** `clouduser` is seeded at project creation holding every service permission in the project, so it is the *catalog* of what exists — not a fence around it.

Two fields get misread as "system-only". Neither is a restriction:

- **`isBuiltIn: true`** means the permission was shipped/seeded by the platform rather than authored by this tenant. It says nothing about who may hold it. Granting built-in permissions to custom roles is the normal, intended way a role gets access to service APIs — not a workaround.
- **`roles[]` containing `clouduser`** (or any other role) is a *membership list* — "these roles currently hold this permission". It is not an ACL on the permission, and it is not exclusive. Nearly every built-in permission lists `clouduser`, precisely because of the seed.

**Refusing to assign is not the safe default.** A role whose users call an API they don't hold the `Endpoint` permission for gets a hard **403 from the gateway** — you ship a role that looks configured and is broken. Declining a built-in grant on "it's a system permission" grounds is a bug, not caution.

The confirmation discipline is unchanged and still applies to every grant (reviewed `--dry-run`, then `--yes`, on the human's explicit instruction). What changes is that "built-in" and "clouduser has it" are never the reason to say no.

## Choosing *which* permissions a role gets

Unrestricted-to-assign is not assign-everything. Never clone `clouduser`'s set onto an application role, and never grant by keyword-matching a role's name. Work from what that role's users actually do:

1. **Enumerate what the role must do** — the concrete API calls its users make and the screens/actions they see. If that isn't known yet, ask; don't guess a set.
2. **Find the candidate permissions** — `blocks iam permissions list --resource-group <group>`, `--resources a,b`, `--search <text>`, or `--type <n>` to scope by kind. `blocks iam resources groups`/`blocks iam resources features` give you the resource/module grouping to walk. `blocks iam permissions by-severity` shows the same catalog bucketed by blast radius.
3. **Match by permission type** — the type decides *what breaks* when a grant is missing, so it decides what you must include:

   | `type` | Enforced by | Missing grant looks like | Grant it when |
   |---|---|---|---|
   | `1` Endpoint | API gateway | **403** on the call | the role's users hit that API at all — non-negotiable |
   | `2` FrontendAction | the SPA's permission gate | no error; button/section silently hidden or disabled | the role should see and use that UI affordance |
   | `3` DataProtection | field/record masking & encryption | data comes back masked/redacted | the role legitimately needs the unmasked field |

   A role usually needs **both** the `Endpoint` permission and the matching `FrontendAction` — granting only the endpoint leaves an invisible button; granting only the frontend action leaves a button that 403s. Check for both when a feature spans API and UI.
4. **Pull in `dependentPermissions`** — a permission whose dependencies aren't also granted still 403s. Read them off `blocks iam permissions get <id>` and include them in the same `--add-permissions` call.
5. **Respect `severity`** — `1` is Critical (tenant-compromising), `4` is Low. High-severity grants are the ones worth naming explicitly in the confirmation you show the human; least privilege means preferring a narrow resource-scoped permission over a broad one when both would work.
6. **Grant the delta, confirm, apply** — `assign-permissions` is additive/subtractive, so send only what's changing.

### Triage: a role's users are getting 403

1. Read the failing request's endpoint from the error, and find its permission: `blocks iam permissions list --type 1 --search <resource-or-endpoint-fragment> --json`.
2. Confirm the role doesn't hold it: `blocks iam permissions list --roles <role-slug> --json`, or check `roles[]` on the permission.
3. Grant it (plus its `dependentPermissions`) after showing the human the exact diff:

```
blocks iam roles assign-permissions <role-slug> --add-permissions <resource>,<dependency> --dry-run
blocks iam roles assign-permissions <role-slug> --add-permissions <resource>,<dependency> --yes
```

If the API succeeds but the control never renders, it's the mirror-image case — a missing `--type 2` FrontendAction, not a 403.

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

The SDK deliberately leaves these request bodies as open `Record<string, unknown>` rather than locking you to a fixed shape — confirm exact field names against the portal or a `list()`/`get()` response before hardcoding new ones. Two fields the SDK's own types do pin down: a role's `slug` (`BlocksRole.slug`) is its stable key — use it, not `itemId`, anywhere the API expects a role reference (e.g. `assignPermissions`); a permission's `resource` and `roles[]` (`BlocksPermission`) tell you what it's scoped to and which roles already hold it — `roles[]` is membership, never a restriction on who else may be granted it.

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

- **Built-in grants:** the two rules above — assignable without a restricted subset, chosen by what the role actually does — are the sections "Built-in permissions are assignable" and "Choosing *which* permissions a role gets"; don't re-derive them here.
- **A feature that spans API and UI needs both its `--type 1` and `--type 2` permissions** — endpoint-only leaves an invisible button, frontend-action-only leaves a button that 403s.
- **CLI mutations are project-scoped, not account-scoped** — `blocks iam roles create/update/assign-permissions` and `blocks iam permissions create/update` all require a selected project (`blocks use <tenantId>` or `--project <tenantId>`) and run against the impersonated-project token. `blocks iam me` prefers the same mode when a project resolves and falls back to account auth only when none does.
- **Role hierarchy and permission assignment key off `slug`**, not `itemId` — grab it from `roles.list()`/`roles.get()` (or `blocks iam roles list/get`) before calling `assignPermissions`.
- **Permission assignment ultimately uses permission `itemId`s** — the CLI resolves `resource` strings like `content::publish` before mutation; SDK/backend callers should pass permission ids directly in `addPermissions` / `removePermissions`.
- **`roles.assignPermissions` is additive/subtractive** (`addPermissions[]` / `removePermissions[]` in one call), not a full-set replace — compute the delta from what's checked/unchecked, don't resend the entire permission list as "adds."
- **`roles.assignable()` scopes to the caller** — always populate role pickers from it rather than `roles.list()`, so an admin can't be shown (or attempt to grant) a role above their own authority.
- **Never fire a create/update/assign-permissions call — CLI or SDK — without a human confirming that specific change first** (a reviewed `--dry-run` plus explicit go-ahead on the CLI, an explicit in-UI confirm for the SDK) — no auto-provisioning "default roles," no agent-initiated cleanup of permissions, no batch edits without a per-change confirm.
- **OIDC/identity-provider client provisioning is a separate concern**, independent of everything above — it runs through `blocks auth oidc-clients`/`auth idp` and is owned by `blocks-iam-sso-oidc-configuration`, not something to bolt onto this role/permission flow.
