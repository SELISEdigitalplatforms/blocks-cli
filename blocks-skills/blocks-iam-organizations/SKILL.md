---
name: blocks-iam-organizations
description: "Work with organizations (multi-tenant workspaces) in a SELISE Blocks app through the @seliseblocks/client SDK's `iam.organizations`, `iam.signupSettings`, and `auth.switchOrganization` — never raw fetch/curl, and never the blocks-os CLI (it has no organization commands at all, only `iam:me`). Use for: an org switcher or 'my organizations' list (`organizations.my`), switching the active org context for a multi-org user (`auth.switchOrganization`), reading tenant signup policy on a public signup screen (`signupSettings.get`), and — only as an explicit, human-confirmed feature inside a signed-in admin's own app screen, never as an autonomous agent action — creating or editing an organization (`organizations.create`/`update`), browsing/looking up orgs (`organizations.list`/`get`), reading or saving org-level config (`organizations.getConfig`/`saveConfig`), and saving signup policy (`signupSettings.save`). Trigger on 'list my organizations', 'org switcher', 'switch organization', 'multi-org', 'create/update an organization', 'organization settings', 'signup settings', 'allow org creation from signup'. Users/roles within an org are blocks-iam-users/blocks-iam-access-control; SSO/OIDC client setup is blocks-onboarding and stays portal-only."
---

# Blocks IAM — Organizations

Organizations are the tenancy/workspace unit inside a Blocks project. Everything here is `@seliseblocks/client` SDK calls from app code — **there is no `blocks-os` CLI surface for organizations at all.** The CLI exposes exactly one IAM command, `iam:me`; org list/create/update/config/signup-settings/switch-org have no CLI equivalent, and that's a deliberate platform decision, not a gap to fill with a raw HTTP call. Never write `fetch`/`curl` against `api.seliseblocks.com/iam/v4/...` for any of this — always go through the SDK instance the scaffold already wired up (`blocksClient` in `src/lib/blocks/client.ts`, from `blocks-os new web`).

**Prerequisite:** the app is a `blocks-os new web` scaffold (React 18 + TypeScript + Vite + Tailwind + Radix + TanStack Query, one shared `blocksClient`) with a project selected. If auth/project state is unknown, run **[blocks-onboarding](../blocks-onboarding/SKILL.md)** first.

## The platform boundary — read this before writing any admin-CRUD call

Full organization management (create, update, config, signup-settings) is intentionally **not** exposed as a CLI command or an agent-automation primitive. This is a settled decision to keep the CLI/agent-automation surface minimal for admin-sensitive IAM areas — organizations are a tenant-isolation boundary, so creating or reconfiguring them is treated with the same caution as the portal-only OIDC provisioning in blocks-onboarding, just via a different mechanism (SDK, not CLI).

That means the `organizations.create`/`update`/`getConfig`/`saveConfig` and `signupSettings.save` methods below are **legitimate to use** — but only as a feature you build *inside* a signed-in admin user's own app: that user is looking at a settings screen in their own UI, explicitly directs the change (clicks "Save," "Create organization," etc.), and the call is bounded by whatever IAM permissions their session token actually has. They are **never** something an agent calls on its own initiative, in a script, or as a side effect of some other task — there's no "autonomous admin" path here.

Concretely: **before wiring up or invoking any `create`/`update`/`saveConfig`/`save` call, restate the exact change back to the user in plain terms (which organization, which fields, old value vs. new value) and get an explicit go-ahead.** This applies whether you're writing the mutation code for the first time or being asked to "just run it" — confirm the payload, not just the intent, since these calls change tenant-level configuration that other users/orgs depend on.

## Read / self-service surface — safe, no special caveat

These are read-only or scoped to switching the *caller's own* context. No confirmation ritual needed beyond normal engineering judgment.

### `organizations.my()` — the org switcher

`GET /iam/v4/iam/organizations/my`. Returns the signed-in user's own available organizations — the standard source for an org switcher / "pick your workspace" UI. Requires the user to already be authenticated (pair with `useCurrentUser` / `blocksClient.iam.me()` from the onboarding/profile scaffold).

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

### `auth.switchOrganization(request)` — change active org context

`POST /iam/v4/auth/switch-org`. For a multi-org user, switches which organization the session is scoped to. Pass `{ organizationId, refreshToken }`; the response is a fresh `BlocksAuthResponse` (new tokens for the new org context). **If your app tracks its own session state (stored tokens, an auth context/provider), replace it with this response** — don't just call the endpoint and leave the old tokens in place, or subsequent calls will still act in the old org.

```ts
async function switchToOrganization(organizationId: string) {
  const refreshToken = getRefreshToken(); // however this app's AuthProvider stores it
  const response = await blocksClient.auth.switchOrganization({ organizationId, refreshToken });
  applyAuthResponse(response); // app-owned: persist new tokens, refresh useCurrentUser/useMyOrganizations
}
```

This is user-directed (they picked an org in the switcher) so it doesn't need the admin-CRUD confirmation ritual — but it does change what the rest of the session sees, so trigger it from an explicit user action (selecting an item in the switcher), not silently.

### `signupSettings.get()` — public signup screen

`GET /iam/v4/iam/signup-settings`. Public — no auth required (the SDK still sends `x-blocks-key`). Read this on a public signup page to know the tenant's current signup policy (e.g., whether self-signup or org-creation-from-signup is allowed) before rendering the form.

```ts
const settings = await blocksClient.iam.signupSettings.get();
```

## Admin-CRUD surface — confirm the exact change first

These mutate tenant-level state. Build them as an explicit feature in an admin settings screen, and confirm the payload with the user before calling — see "The platform boundary" above.

### `organizations.list(query)` / `organizations.get(id)` — browse and inspect

`GET /iam/v4/iam/organizations` (paging/search query params) and `GET /iam/v4/iam/organizations/{id}`. Read-only, so no confirmation is needed to call them — but they're part of the admin org-management surface (browsing arbitrary orgs, not just "my own"), so gate the screen itself behind whatever admin permission the app already checks. Typical use: an org-picker/detail view feeding into an edit form, populated before a `create`/`update` call.

```ts
const page = await blocksClient.iam.organizations.list({ Page: 1, PageSize: 20, "Filter.Name": search });
const org = await blocksClient.iam.organizations.get(organizationId);
```

### `organizations.create(request)` / `organizations.update(id, request)`

`POST /iam/v4/iam/organizations/create` and `POST /iam/v4/iam/organizations/{id}`. Create/edit an organization's record (name, description, contact info, branding, addresses, default roles/permissions for new members, etc. — see the old skill's `endpoints.md` for the historical field list if you need a reference, but verify current field names against what the admin UI/API actually accepts rather than assuming they haven't changed).

```ts
// Only after the admin has reviewed and confirmed this exact payload:
await blocksClient.iam.organizations.create({
  name: "Acme Logistics",
  description: "Acme's logistics division workspace"
  // ...remaining fields the user confirmed
});

await blocksClient.iam.organizations.update(organizationId, {
  name: "Acme Logistics (Renamed)"
  // ...only the fields the user asked to change
});
```

### `organizations.getConfig()` / `organizations.saveConfig(request)` — org-level settings

`GET`/`POST /iam/v4/iam/organizations/config`. Project/org-wide policy, including multi-org enablement. Read the current config first, show the user the diff of what would change, then save.

```ts
const current = await blocksClient.iam.organizations.getConfig();
// ...user reviews current vs. proposed, confirms...
await blocksClient.iam.organizations.saveConfig({
  ...current,
  isMultiOrgEnabled: true
});
```

### `signupSettings.save(request)` — save signup policy

`POST /iam/v4/iam/signup-settings`. Same confirm-first rule: this changes what the public signup screen allows for every future visitor, so restate the exact policy change (e.g., "turn on org creation from signup") before calling.

```ts
await blocksClient.iam.signupSettings.save({
  ...currentSettings,
  allowOrgCreationFromSignup: true
});
```

## Gotchas

- **No CLI path, ever.** If a user asks "what's the `blocks-os` command for organizations," the honest answer is there isn't one — only `blocks-os iam:me` exists for IAM in the CLI. Don't invent `blocks-os org:*` commands or fall back to raw `curl`/`fetch`.
- **Confirm the payload, not just the intent**, before any `create`/`update`/`saveConfig`/`signupSettings.save` call — restate which organization and which fields are changing, old value vs. new, and wait for a clear yes. This is the same discipline as the portal-only OIDC steps in blocks-onboarding, applied to SDK mutations instead of portal clicks.
- **These are legitimate app features, not agent shortcuts.** It's fine to build an "Create Organization" admin screen with a confirm dialog that calls `organizations.create` — that's the intended use. It's not fine for an agent to call `organizations.create`/`saveConfig` on its own initiative (e.g., to "set things up" for a demo) without that human-in-the-loop screen.
- **`switchOrganization` replaces session state.** If the app persists tokens (localStorage, an AuthProvider, React Query cache), apply the new `BlocksAuthResponse` fully — a stale access token after switching orgs will produce confusing "wrong org" data on the next call.
- **`organizations.my()` needs the user already authenticated** — call it after `iam.me()`/`useCurrentUser` resolves, not before, or you'll get an auth failure that looks like "no orgs" but actually means "not logged in yet."
- **Multi-org must be enabled** (`isMultiOrgEnabled` via `organizations.getConfig()`) for more than one org per user to be meaningful — if a user reports "switching orgs doesn't do anything," check this first.
- **Different response shapes per call** — `my()`/`list()` return an array-shaped payload, `get(id)` returns a single organization, `create` returns an id. Don't assume a single envelope shape across all of them; check the actual response before wiring UI to a field path.

## Example trigger prompts

- "Add an org switcher to the sidebar using the current user's organizations."
- "Let a multi-org user switch which organization they're working in."
- "Show the tenant's signup policy on our public signup page."
- "Build an admin screen to create a new organization." (confirm the fields with the user before calling `create`)
- "Turn on multi-org for this project." (read `getConfig` first, confirm the change, then `saveConfig`)
- "Enable multi-org and list my organizations."
- "Is there a `blocks-os` command to list organizations?" → no, explain the CLI has no org commands, only `iam:me`; this goes through the SDK instead.
