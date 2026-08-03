---
name: blocks-iam-users
description: "Manage OTHER users' IAM records inside a SELISE Blocks app, through the `iam.users.*` methods on the app's single `@seliseblocks/client` instance (`blocksClient.iam.users`) — never raw fetch/curl. Covers safe reads (`get`, `list`, `emailAvailable`, `exists`) and admin-mutation actions (`create`, `update`, `deactivate`, `activate`, `updateAccess`, `revokeAccess`) that a signed-in admin drives through their own app UI. Use whenever the user wants to invite/create a user, edit another user's profile, deactivate or reactivate a user, list/search/look up users, check if an email is taken, or grant/revoke a user's roles or org access — 'invite a user', 'deactivate this account', 'list all users', 'give this user the admin role', 'check if this email is already registered'. Does NOT cover the CURRENT signed-in user's own self-service profile/activation/password (that's blocks-iam-account), defining roles/permissions themselves (blocks-iam-access-control), or any `blocks-os` CLI command — the CLI only exposes read-only `iam:me`, nothing else under IAM."
---

# Blocks IAM — Managing Other Users

This skill is about an **admin managing other people's IAM accounts** from inside a Blocks app — inviting them, editing their profile, changing their access, deactivating them. It is not about the signed-in user managing their own account (that's **[blocks-iam-account](../blocks-iam-account/SKILL.md)**) and not about defining the roles/permissions being assigned (that's **blocks-iam-access-control**).

Everything here goes through the SDK: `blocksClient.iam.users.*` on the app's single `@seliseblocks/client` instance (created once, typically at `src/lib/blocks/client.ts` by `blocks-os new web`). **Never raw `fetch`/`curl` against `api.seliseblocks.com`.**

```ts
import { blocksClient } from "../../lib/blocks/client";

const { data } = await blocksClient.iam.users.get(userId);
```

## Platform boundary: this is app-UI territory, not CLI or autonomous-agent territory

`blocks-os` (the CLI) deliberately exposes only `iam:me` — read the current logged-in user, nothing else. Full user administration (create, update, deactivate, access changes) is **not** a CLI capability. That's a settled platform decision: admin-sensitive IAM surface is kept out of the CLI/agent-automation layer on purpose.

The `iam.users.*` SDK methods below exist to build that admin capability **as a feature inside a signed-in admin's own app** — the admin is looking at a screen, clicking "Deactivate" on a specific user row, and their own IAM permissions gate whether the call succeeds. That is legitimate.

What is **not** legitimate: an agent deciding on its own, without the human in front of the app explicitly directing that specific action in the moment, to call `create`/`update`/`deactivate`/`activate`/`updateAccess`/`revokeAccess`. Treat every mutating call the same way the CLI treats `--dry-run` before `--yes` — state the exact change in plain language and get the user's explicit go-ahead first, every time, even if they asked for something adjacent a moment ago.

## Safe surface — reads and checks, no confirmation needed

These don't change anything, so there's no caveat to apply:

| Method | What it does |
|---|---|
| `iam.users.get(id, { organizationId? })` | One user record, optionally scoped to an org. |
| `iam.users.list(request)` | Paged/filtered user query. **This is a POST-read contract** — `list` sends `{ pageNo, pageSize, filter, search, ... }` as a POST body, it is not a GET. |
| `iam.users.emailAvailable(query)` | Public duplicate-email check for invite/signup forms. No auth needed. |
| `iam.users.exists(email)` | Existence check by email. |

```ts
const page = await blocksClient.iam.users.list({ pageNo: 1, pageSize: 20, search: "jane" });
const check = await blocksClient.iam.users.emailAvailable({ email: "new.hire@example.com" });
```

## Sensitive surface — confirm the exact change before calling

Every method below mutates a real account. Before calling any of them, restate to the user in plain language exactly what will change (which user, which field, which effect) and wait for an explicit yes — do not infer consent from an earlier, more general request.

| Method | What it does |
|---|---|
| `iam.users.create(request)` | Invites/provisions a user in the active tenant/organization. |
| `iam.users.update(id, request)` | Edits an IAM profile's fields. |
| `iam.users.deactivate(request)` | Removes access without deleting the record. |
| `iam.users.activate(request)` | Restores access for a previously deactivated account. |
| `iam.users.updateAccess(request)` | Grants or changes roles/permissions/org access for a user. |
| `iam.users.revokeAccess(request)` | Removes roles/permissions/org access from a user. |

Example — deactivating a user:

> Agent: "This will deactivate **jane.doe@example.com** (user id `usr_8a2f`) — she'll immediately lose access but her record and history stay intact. Confirm?"
> User: "Yes, deactivate her."
> *(only then)* `await blocksClient.iam.users.deactivate({ userId: "usr_8a2f" });`

Never chain a mutation straight off a read (e.g. don't look a user up and deactivate them in the same breath just because the user asked to "find inactive-looking accounts") — surface what you found, then get a decision on each mutation separately.

```ts
// After the user explicitly confirms creating this exact invite:
await blocksClient.iam.users.create({
  email: "new.hire@example.com",
  firstName: "New",
  lastName: "Hire",
  roles: ["member"]
});

// After the user explicitly confirms this exact access change:
await blocksClient.iam.users.updateAccess({ userId: "usr_8a2f", roles: ["editor"] });
```

## Gotchas

- **`list` is a POST**, not a GET — don't assume query-string filtering.
- **Roles are referenced by slug**, as defined in blocks-iam-access-control — not by their internal item ids.
- **`organizationId`** matters in multi-org projects — pass it to `get` when you need a user's record in a specific org context.
- **Every request/response type in the SDK is a loosely-typed `Record<string, unknown>`** (`BlocksUser`, `BlocksBaseResponse`, etc. only guarantee a few common fields) — treat fields defensively and confirm shape against a live response for the project rather than assuming a fixed schema.
- **Don't reach for the CLI here** — `blocks-os` has no user-admin commands beyond `iam:me`; this is exclusively app/SDK territory.
- **Don't duplicate blocks-iam-account** — if the ask is "let me update my own profile" or "let me reset my password," that's the current user acting on themselves, not this skill.

## Example triggers

- "Invite a user and set their roles"
- "Deactivate this user's account"
- "List all users in the org, filtered by status"
- "Check if this email is already registered before I show the invite form"
- "Grant this user the editor role"
- "Revoke this user's access to the finance org"
- "Update this user's phone number"
- "Reactivate this account"
