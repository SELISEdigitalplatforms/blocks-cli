# Flow: Read / self-service surface (safe, no special caveat)

These are read-only or scoped to switching the *caller's own* context. No confirmation ritual needed beyond normal engineering judgment.

## `organizations.my()` — the org switcher

Returns the signed-in user's own available organizations — the standard source for an org switcher / "pick your workspace" UI. Requires the user to already be authenticated (pair with `useCurrentUser` / `blocksClient.iam.me()` from the onboarding/profile scaffold).

```ts
// src/features/organizations/useMyOrganizations.ts
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../app/providers/AuthProvider";
import { blocksClient } from "../../lib/blocks/client";

export function useMyOrganizations() {
  const { status } = useAuth();
  return useQuery({
    enabled: status === "authenticated",
    queryFn: () => blocksClient.iam.organizations.my(),
    queryKey: ["iam", "organizations", "my"]
  });
}
```

CLI equivalent: `blocks iam organizations my` (read-only, project-scoped).

## `auth.switchOrganization(request)` — change active org context

For a multi-org user, switches which organization the session is scoped to. Pass `{ organizationId, refreshToken }`; the response is a fresh `BlocksAuthResponse` (new tokens for the new org context). **If your app tracks its own session state (stored tokens, an auth context/provider), replace it with this response** — don't just call the endpoint and leave the old tokens in place, or subsequent calls will still act in the old org.

```ts
async function switchToOrganization(organizationId: string) {
  const refreshToken = getRefreshToken(); // however this app's AuthProvider stores it
  const response = await blocksClient.auth.switchOrganization({ organizationId, refreshToken });
  applyAuthResponse(response); // app-owned: persist new tokens, refresh useCurrentUser/useMyOrganizations
}
```

This is user-directed (they picked an org in the switcher) so it doesn't need the admin-CRUD confirmation ritual — but it does change what the rest of the session sees, so trigger it from an explicit user action (selecting an item in the switcher), not silently.

**No CLI equivalent exists for this one** — switching the *active session's* org context only makes sense from inside the app that owns that session, so it's SDK/app-only. Don't invent a `blocks iam organizations switch` command.

## `signupSettings.get()` — public signup screen

Public — no auth required (the SDK still sends `x-blocks-key`). Read this on a public signup page to know the tenant's current signup policy (e.g., whether self-signup or org-creation-from-signup is allowed) before rendering the form.

```ts
const settings = await blocksClient.iam.signupSettings.get();
```

CLI equivalent for scripting/inspection: `blocks iam signup-settings get --json` (no SDK needed, no app context needed).

## Gotchas

- **`switchOrganization` replaces session state.** If the app persists tokens (localStorage, an AuthProvider, React Query cache), apply the new `BlocksAuthResponse` fully — a stale access token after switching orgs will produce confusing "wrong org" data on the next call.
- **`organizations.my()` needs the user already authenticated** — call it after `iam.me()`/`useCurrentUser` resolves, not before, or you'll get an auth failure that looks like "no orgs" but actually means "not logged in yet."
- **Multi-org must be enabled** (`isMultiOrgEnabled` via `organizations.getConfig()` — see [admin-mutations.md](admin-mutations.md)) for more than one org per user to be meaningful — if a user reports "switching orgs doesn't do anything," check this first.
