---
name: blocks-iam-users
description: "Manage OTHER users' IAM records via `blocksClient.iam.users.*` (never raw fetch/curl), or the equivalent project-scoped `blocks iam users *` / `blocks iam email available` CLI. Covers reads (`get`, `list`, `emailAvailable`, `exists`) and admin mutations (`create`, `update`, `activate`, `deactivate`, `updateAccess`, `revokeAccess`) — CLI mutations require `--dry-run`/`--yes`. Use to invite, edit, deactivate/reactivate, list/search users, or grant/revoke roles/org access. Not for the current user's own profile (blocks-iam-account) or role/permission definitions (blocks-iam-access-control)."
---

# Blocks IAM — Managing Other Users

This skill is about an **admin managing other people's IAM accounts** from inside a Blocks app — inviting them, editing their profile, changing their access, deactivating them. It is not about the signed-in user managing their own account (that's the **blocks-iam-account** skill) and not about defining the roles/permissions being assigned (that's **blocks-iam-access-control**).

Everything here goes through the SDK: `blocksClient.iam.users.*` on the app's single `@seliseblocks/client` instance (created once, typically at `src/lib/blocks/client.ts` by `blocks new web`). **Never raw `fetch`/`curl` against `api.seliseblocks.com`.**

```ts
import { blocksClient } from "../../lib/blocks/client";

const { data } = await blocksClient.iam.users.get(userId);
```

## Two surfaces, same operations: SDK (in-app) and CLI (`blocks iam users *`)

There are two legitimate ways to drive full user administration (create, update, deactivate, activate, access grant/revoke) — both are covered by this skill:

- **SDK — `blocksClient.iam.users.*`** — build the capability **as a feature inside a signed-in admin's own app**: the admin is looking at a screen, clicking "Deactivate" on a specific user row, and their own IAM permissions gate whether the call succeeds.
- **CLI — `blocks iam users *` / `blocks iam email available`** — the same operations, invoked directly from a terminal or an agent's shell tool. These are fully wired, project-scoped commands (see "CLI surface" below), not a read-only stub — `iam me` is a separate, account-scoped command for the CLI operator's own identity and is not the only IAM command the CLI has.

What is **not** legitimate on either surface: an agent deciding on its own, without the human explicitly directing that specific action in the moment, to call `create`/`update`/`deactivate`/`activate`/`updateAccess`/`revokeAccess` (SDK) or `users create`/`update`/`activate`/`deactivate`/`access grant`/`access revoke` (CLI). State the exact change in plain language and get the user's explicit go-ahead first, every time, even if they asked for something adjacent a moment ago. The CLI enforces this mechanically — every mutating command requires `--dry-run` (preview only, no call) or `--yes`/an interactive "yes" before it executes — but that built-in gate doesn't replace stating the change and getting a real go-ahead when an agent is the one typing the command.

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

## CLI surface — `blocks iam users *`, `blocks iam email available`

These are real, fully-wired commands — not a stub and not limited to `iam me`. `iam me` is a separate, account-scoped command (current CLI operator's own identity via the account token); every command below is **project-scoped**: it requires a project already selected (`blocks use <project-tenant-id>`) and calls IAM with an impersonated project token, same as the rest of the project-scoped CLI surface.

Reads — no confirmation needed:

| Command | What it does |
|---|---|
| `blocks iam users list [--page 1] [--page-size 20] [--email <e>] [--name <n>] [--organization-id <id>] [--sort-by <field>] [--sort-desc] [--filter '<json>'] [--json]` | Paged/filtered user query. `--filter` merges a raw JSON object over the convenience flags. |
| `blocks iam users get <id> [--organization-id <id>] [--json]` | One user record, optionally scoped to an org. |
| `blocks iam users exists <email> [--json]` | Existence check by email. |
| `blocks iam email available <email> [--json]` | Duplicate-email check. |

Mutations — every one supports `--dry-run` (print the request body and exit, no call) and requires either `--yes` or a typed `yes` at an interactive prompt before it executes:

| Command | What it does |
|---|---|
| `blocks iam users create --email <e>\|--user-name <n> [--first-name] [--last-name] [--password] [--phone-number] [--organization-id] [--roles a,b] [--permissions a,b] [--body '<json>'\|--file <path>] [--dry-run] [--yes] [--json]` | Invites/provisions a user. |
| `blocks iam users update <id> [--first-name] [--last-name] [--phone-number] [--organization-id] [--roles a,b] [--permissions a,b] [--body '<json>'\|--file <path>] [--dry-run] [--yes] [--json]` | Edits an IAM profile's fields. |
| `blocks iam users activate <userId> [--reason <text>] [--dry-run] [--yes] [--json]` | Restores access for a previously deactivated account. |
| `blocks iam users deactivate <userId> [--dry-run] [--yes] [--json]` | Removes access without deleting the record. |
| `blocks iam users access grant <userId> [--roles a,b] [--permissions a,b] [--organization-id] [--dry-run] [--yes] [--json]` | Grants roles/permissions/org access (requires at least one of `--roles`/`--permissions`). |
| `blocks iam users access revoke <userId> [--organization-id] [--dry-run] [--yes] [--json]` | Revokes org access for a user. |

Command segments joined by a space also accept a colon (`iam:users:access:grant` etc.) — both forms resolve to the same handler; `blocks iam users --help`-style docs in the CLI's own `--help` output use the space form shown above.

Example — deactivating a user from the CLI, dry-run first:

```sh
blocks iam users deactivate usr_8a2f --dry-run   # preview the request body, no call made
blocks iam users deactivate usr_8a2f --yes       # after the user explicitly confirms
```

Apply the same confirm-before-mutating discipline here as with the SDK: state which user and which effect, wait for an explicit yes, don't chain a mutating command straight off a `list`/`get` just because the user asked to "find" something.

## Gotchas

- **`list` is a POST**, not a GET — don't assume query-string filtering.
- **Roles are referenced by slug**, as defined in blocks-iam-access-control — not by their internal item ids.
- **`organizationId`** matters in multi-org projects — pass it to `get` when you need a user's record in a specific org context.
- **Every request/response type in the SDK is a loosely-typed `Record<string, unknown>`** (`BlocksUser`, `BlocksBaseResponse`, etc. only guarantee a few common fields) — treat fields defensively and confirm shape against a live response for the project rather than assuming a fixed schema.
- **The CLI is project-scoped, not account-scoped** — `blocks iam users *`/`blocks iam email available` need a selected project (`blocks use <project-tenant-id>`) and use an impersonated project token; `iam me` is the one exception that runs on the account token instead.
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
- "From the terminal, deactivate user usr_8a2f in the current project" → use `blocks iam users deactivate usr_8a2f`, `--dry-run` first, then `--yes` after explicit confirmation
