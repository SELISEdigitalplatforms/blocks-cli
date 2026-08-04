---
name: blocks-iam-access-control
description: "Work with SELISE Blocks RBAC (roles & permissions) via `blocks iam roles/permissions *` (CLI, project-scoped) or `blocksClient.iam.*` (SDK), never raw fetch/curl. Two facets: read-only feature-gating by the current user's own roles/permissions (common, safe) vs. creating/editing role and permission definitions (sensitive, human-confirmed only — CLI `--dry-run`→`--yes` or an in-app admin screen). OIDC/identity-provider provisioning stays portal-only, a different concern. Use for permission-gated UI, role/permission pickers, or building/scripting role & permission admin ('gate this button by permission', 'create a role and grant permissions', 'list permissions by severity')."
---

# Blocks IAM — Access Control (Permissions & Roles)

This skill covers **permission and role definitions** in SELISE Blocks — the RBAC model itself, not who has which role (that's [blocks-iam-users](../blocks-iam-users/SKILL.md)). Everything goes through either `blocks iam roles/permissions *` (CLI) or `blocksClient.iam.*` from **`@seliseblocks/client`**, the single SDK instance every `blocks new web` scaffold wires up at `src/lib/blocks/client.ts` and exports as `blocksClient`. No raw `fetch`/`curl` for either surface.

```ts
import { blocksClient } from "../../lib/blocks/client";
```

## The platform boundary — read this before writing any code

Role and permission administration is **not** portal-only or app-UI-only — `blocks` has a full, working CLI surface for it too (`iam:roles:*` / `iam:permissions:*` in `blocks-cli/src/index.ts`). There are two equally real surfaces for the same operations, and the choice is about *where the human is*, not which one is "allowed" — see [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md) for the full command reference and the CLI-vs-SDK decision.

Identity-provider/OIDC client provisioning is the one piece that really is **portal-only, human-driven**, at `https://os.seliseblocks.com` — unrelated to roles/permissions, don't bolt it onto this skill.

Keep the two facets below (read-only feature-gating vs. sensitive admin mutations) separate in your head (and in your code) — they have very different risk profiles regardless of which surface (CLI or SDK) you're using.

## Facet 1 — Feature-gating a frontend by the user's own permissions (common, low risk)

Read-only, scoped to whoever is signed in, needs no special confirmation. `useCurrentUser()` + `iam.resources.features()` + `iam.roles.assignable()`.

→ Full walkthrough: [flows/feature-gating.md](flows/feature-gating.md)

## Facet 2 — Creating/editing roles & permissions (sensitive)

Legitimate only in direct response to a human's explicit, in-the-moment instruction — CLI (`--dry-run` reviewed, then `--yes`) or a signed-in admin's own in-app screen. Never something an agent decides to invoke on its own initiative.

→ Full command reference, SDK methods, and confirm-before-mutating pattern: [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md)

## Gotchas

- **CLI mutations are project-scoped, not account-scoped** — they run against the impersonated-project token; `blocks iam me` is the one IAM command that uses the account token instead.
- **Role hierarchy and permission assignment key off `slug`**, not `itemId`.
- **Never fire a create/update/assign-permissions call — CLI or SDK — without a human confirming that specific change first.** See [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md) for the full discipline.
- **OIDC/identity-provider client provisioning is always portal-only**, independent of everything above.

## Example trigger prompts

- "Only show the delete button to users who have the `order::delete` permission." → Facet 1
- "Hide this whole admin section unless the signed-in user has an admin role." → Facet 1
- "What roles am I allowed to assign to other users?" → Facet 1
- "Show me permissions grouped by severity in a settings panel." → Facet 1
- "Build an admin page where I can create a role and pick which permissions it gets." → Facet 2
- "Create a `content-editor` role from the CLI with these permissions." → Facet 2
- "Can you just set up a few default roles for my project?" → confirm the exact list with the human first (in chat, or via a reviewed `--dry-run`), then run each `blocks iam roles create`/`assign-permissions` with `--yes` only after they say go — don't auto-provision without that per-change confirmation.
