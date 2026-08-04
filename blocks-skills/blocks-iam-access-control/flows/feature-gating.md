# Flow: Feature-gating a frontend by the user's own permissions (common, low risk)

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

There is also a CLI read path for the same data, useful outside an app (scripting/inspection): `blocks iam roles list/get/assignable` and `blocks iam permissions list/get/by-severity` — see [manage-roles-permissions.md](manage-roles-permissions.md) for the full CLI command reference (it covers both reads and mutations).
