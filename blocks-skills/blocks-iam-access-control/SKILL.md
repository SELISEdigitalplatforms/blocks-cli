---
name: blocks-iam-access-control
description: "Work with SELISE Blocks RBAC — permissions and roles — through the @seliseblocks/client SDK's blocksClient.iam.permissions / iam.roles / iam.resources methods only, never raw fetch/curl. Two distinct use cases: (1) feature-gating a signed-in user's own frontend by their current roles/permissions via iam.me(), iam.resources.features(), and iam.roles.assignable() — common, low-risk, read-only, no special caveat; and (2) building an ADMIN screen where an authorized admin user creates or edits role/permission definitions via iam.permissions.create/update and iam.roles.create/update/assignPermissions — sensitive, and only ever triggered by that human explicitly clicking through the app's own UI in the moment, confirmed before each create/update, never invoked autonomously by an agent. The blocks CLI deliberately exposes only `iam me` and nothing else under IAM — roles, permissions, users, and organizations are not CLI or agent-automation surfaces; use SDK mutations only as explicit, human-confirmed in-app admin UI actions. OIDC/identity-provider client provisioning remains portal-only at https://os.seliseblocks.com. Use this skill whenever the user wants to: hide or show UI by permission ('only show this button to users with X permission', 'gate this admin nav item by role'), check which roles the current user may assign, list permissions by severity or resource group/feature flag, or build/extend an in-app admin screen for managing roles and permissions ('create a role and grant it these permissions', 'add a new permission definition', 'let admins edit a role's permissions from the settings page'). Assigning a role/permission to a specific USER (as opposed to defining the role/permission itself) is out of scope here; OIDC/identity-provider client provisioning is always portal-only regardless."
---

# Blocks IAM — Access Control (Permissions & Roles)

This skill covers **permission and role definitions** in SELISE Blocks — the RBAC model itself, not who has which role. Everything goes through `blocksClient.iam.*` from **`@seliseblocks/client`**, the single SDK instance every `blocks new web` scaffold wires up at `src/lib/blocks/client.ts` and exports as `blocksClient`. There is no raw `fetch`/`curl` path in the current tooling and no reason to reach for one.

```ts
import { blocksClient } from "../../lib/blocks/client";
```

## The platform boundary — read this before writing any code

**`blocks` deliberately exposes exactly one IAM command: `blocks iam me --json`.** That's it. There is no `blocks iam roles create`, no `iam permissions list`, no `iam users *`. This isn't a gap to fill — it's a settled platform decision: role, permission, user, and organization administration are not CLI or agent-automation surfaces. Identity-provider/OIDC client provisioning stays **portal-only, human-driven**, at `https://os.seliseblocks.com`. IAM SDK mutations are legitimate only inside a signed-in admin's own app UI after that human confirms the exact action.

That said, the SDK itself is not artificially crippled: `blocksClient.iam.permissions` and `blocksClient.iam.roles` expose full `create`/`update`/`list`/`get` methods, because there's a legitimate use for them — **inside an app that a signed-in admin user is actively operating.** If you're building that user their own admin settings screen, and *they* click "Create role" through that screen, calling `iam.roles.create()` from the app's code is exactly what the SDK method is for. The line is:

- **Fine:** a feature inside a human's own app, bounded by that human's own IAM permissions, executed because they just clicked a specific button for a specific change.
- **Not fine:** an agent deciding on its own to call `create`/`update`/`assignPermissions` — whether to "help out," to fix something it noticed, or as part of a larger task the user didn't ask it to take this specific action for.

Keep these two facets separate in your head (and in your code) — they have very different risk profiles.

## Facet 1 — Feature-gating a frontend by the user's own permissions (common, low risk)

This is read-only against IAM and scoped to whoever is signed in, so it needs no special confirmation — build it the same way you'd build any other data-fetching feature.

The scaffold already gives you a `useCurrentUser()` hook (`src/features/profile/useCurrentUser.ts`) wrapping `blocksClient.iam.me()` with TanStack Query; `me()` returns `{ data: { itemId, email, firstName, lastName, roles: string[], permissions: string[], ... } }`. Reuse it instead of re-fetching:

```ts
// src/features/access/usePermission.ts
import { useCurrentUser } from "../profile/useCurrentUser";

export function useHasPermission(permission: string): boolean {
  const me = useCurrentUser();
  return me.data?.data?.permissions?.includes(permission) ?? false;
}

export function useHasRole(role: string): boolean {
  const me = useCurrentUser();
  return me.data?.data?.roles?.includes(role) ?? false;
}
```

```tsx
// src/shared/ui/RequirePermission.tsx
import type { ReactNode } from "react";
import { useHasPermission } from "../../features/access/usePermission";

export function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  if (!useHasPermission(permission)) return null;
  return <>{children}</>;
}
```

Two more read methods round this out:

- `blocksClient.iam.resources.features(query?)` — `GET /iam/v4/iam/resource/features`. Feature/resource flags for the active user context; use this to drive nav items or feature flags that are more granular than a flat permission string.
- `blocksClient.iam.roles.assignable()` — `GET /iam/v4/iam/roles/assignable`. Lists roles the **current caller** is allowed to assign. If you're building a "grant this user a role" picker, populate it from `assignable()`, not from `roles.list()` — don't assume every role in the system is one this particular admin may hand out.

## Facet 2 — Building an admin screen for roles & permissions (sensitive)

This is the write side, and it's legitimate **only as a feature the signed-in admin operates themselves**, never as something an agent decides to invoke on its own initiative. Methods available (all from `blocksClient.iam`, per `iam-client.ts`):

- `permissions.create(request)` / `permissions.update(id, request)` — define or edit a permission.
- `permissions.list(request)` — `POST /iam/v4/iam/permissions`, paged/filtered search.
- `permissions.bySeverity()` — permissions grouped by severity, handy for a categorized picker.
- `permissions.get(id)` — one permission's detail.
- `roles.create(request)` / `roles.update(request)` — define or edit a role.
- `roles.list(request)` / `roles.get(id)` — search / fetch one role.
- `roles.assignPermissions(request)` — attach/detach permissions on a role.
- `roles.assignable()` — same read method as Facet 1; also useful here to limit which roles this admin's screen lets them touch at all.
- `resources.groups()` — `GET /iam/v4/iam/resource-groups`, metadata for grouping permissions by resource in the UI (e.g. a permissions picker organized by resource/module).

The SDK deliberately leaves these request bodies as open `Record<string, unknown>` rather than locking you to a fixed shape — confirm exact field names against the portal or a `list()`/`get()` response before hardcoding new ones. Two fields the SDK's own types do pin down: a role's `slug` (`BlocksRole.slug`) is its stable key — use it, not `itemId`, anywhere the API expects a role reference (e.g. `assignPermissions`); a permission's `resource` and `roles[]` (`BlocksPermission`) tell you what it's scoped to and which roles already hold it.

**Before calling any of `permissions.create`, `permissions.update`, `roles.create`, `roles.update`, or `roles.assignPermissions` from your admin screen's code, the screen itself must get an explicit, in-the-moment confirmation from the admin operating it** — the same discipline `blocks` enforces with `--dry-run` before `--yes` on every mutating command. Concretely, that means the screen should:

1. Let the admin build up the change in the UI (pick a role, check/uncheck permissions, edit a name) without calling anything yet.
2. Show a clear summary of exactly what will change — "Grant `Editor` role: + `content::publish`, − `content::archive`" — before any network call.
3. Only fire the `create`/`update`/`assignPermissions` call after the admin clicks an explicit confirm ("Save changes", "Create role") for *that specific* change.

Don't collapse steps 2–3 into an auto-save on every checkbox click, and don't have an agent call these methods proactively (e.g. as part of "let me clean up your roles" or "I'll just add the permission you mentioned needing") — only in direct response to the human's own confirmed action through the screen.

Example: a role's permission editor, wired to a confirm step.

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

## Gotchas

- **`blocks` has no write path for any of this** — don't script `iam roles create` or similar; it doesn't exist and shouldn't be added. `iam me --json` is the only supported IAM command.
- **Role hierarchy and permission assignment key off `slug`**, not `itemId` — grab it from `roles.list()`/`roles.get()` before calling `assignPermissions`.
- **`roles.assignPermissions` is additive/subtractive** (`addPermissions[]` / `removePermissions[]` in one call), not a full-set replace — compute the delta from what's checked/unchecked, don't resend the entire permission list as "adds."
- **`roles.assignable()` scopes to the caller** — always populate role pickers from it rather than `roles.list()`, so an admin can't be shown (or attempt to grant) a role above their own authority.
- **Never wire a create/update/assignPermissions call to run without a human confirming that specific change in the UI first** — no auto-provisioning "default roles," no agent-initiated cleanup of permissions, no batch edits without a per-change confirm.
- **OIDC/identity-provider client provisioning is always portal-only**, independent of everything above — if a request drifts into "create an OIDC client" or "add an identity provider," that's a different skill's territory (or no skill's — send the user to the portal), not something to bolt onto this one.

## Example trigger prompts

- "Only show the delete button to users who have the `order::delete` permission."
- "Hide this whole admin section unless the signed-in user has an admin role."
- "What roles am I allowed to assign to other users?"
- "Show me permissions grouped by severity in a settings panel."
- "Build an admin page where I can create a role and pick which permissions it gets."
- "Add a checkbox to grant the `Editor` role the `content::publish` permission."
- "Can you just set up a few default roles for my project?" → that's a human clicking through their own admin screen (or the portal), not something to do autonomously — ask what screen they want built, or point to `https://os.seliseblocks.com`.
