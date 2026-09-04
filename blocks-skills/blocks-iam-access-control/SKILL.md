---
name: blocks-iam-access-control
description: "Work with SELISE Blocks RBAC (roles & permissions) via `blocks iam roles/permissions *` (CLI, project-scoped) or `blocksClient.iam.*` (SDK), never raw fetch/curl. Two facets: read-only feature-gating by the current user's own roles/permissions (common, safe), and creating/editing role and permission definitions (sensitive — CLI `--dry-run`→`--yes`, or an in-app admin screen). Use for permission-gated UI, role/permission pickers, scripting role & permission admin, granting platform-seeded (built-in) permissions to custom roles, or diagnosing 403s / missing UI controls caused by an under-permissioned role. OIDC/identity-provider setup is a different skill."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks IAM — Access Control (Permissions & Roles)

This skill covers **permission and role definitions** in SELISE Blocks — the RBAC model itself, not who has which role (that's the blocks-iam-users skill). Everything goes through either `blocks iam roles/permissions *` (CLI) or `blocksClient.iam.*` from **`@seliseblocks/client`**, the single SDK instance every `blocks new web` scaffold wires up at `src/lib/blocks/client.ts` and exports as `blocksClient`. No raw `fetch`/`curl` for either surface.

For CLI work, if account or project context is unknown, use blocks-bootstrap
first. Do not add login or project-selection logic to this skill.

```ts
import { blocksClient } from "../../lib/blocks/client";
```

## The platform boundary — read this before writing any code

Role and permission administration is **not** portal-only or app-UI-only — `blocks` has a full, working CLI surface for it too. There are two equally real surfaces for the same operations, and the choice is about *where the human is*, not which one is "allowed" — see [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md) for the full command reference and the CLI-vs-SDK decision.

Identity-provider/OIDC client provisioning is a different concern entirely — driven through `blocks auth oidc-clients`/`auth idp` (the portal is an alternative, not a requirement), and owned by the blocks-iam-sso-oidc-configuration skill. Unrelated to roles/permissions; do not bolt it onto this skill.

Keep the two facets below (read-only feature-gating vs. sensitive admin mutations) separate in your head (and in your code) — they have very different risk profiles regardless of which surface (CLI or SDK) you're using.

## Facet 1 — Feature-gating a frontend by the user's own permissions (common, low risk)

Read-only, scoped to whoever is signed in, needs no special confirmation. `useCurrentUser()` + `iam.resources.features()` + `iam.roles.assignable()`.

→ Full walkthrough: [flows/feature-gating.md](flows/feature-gating.md)

## Facet 2 — Creating/editing roles & permissions (sensitive)

Legitimate only in direct response to a human's explicit, in-the-moment instruction — CLI (`--dry-run` reviewed, then `--yes`) or a signed-in admin's own in-app screen. Never something an agent decides to invoke on its own initiative.

Sensitive means *confirmed*, not *refused*: **any permission the seeded `clouduser` system user holds is assignable to any role, with no restricted subset** — `isBuiltIn: true` and `clouduser` in a permission's `roles[]` are never grounds to decline a grant. The judgement call is *which* permissions a given role needs (`Endpoint` for the APIs its users call, `FrontendAction` for the UI they see, `DataProtection` for unmasked fields), not *whether* built-ins may be granted.

→ Full command reference, SDK methods, choosing a role's permission set, 403 triage, and the confirm-before-mutating pattern: [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md)

## Gotchas

- **CLI mutations are project-scoped, not account-scoped** — they run against the impersonated-project token. `blocks iam me` prefers that token when a project resolves and uses the account token only without a resolved project.
- **Role hierarchy and permission assignment key off `slug`**, not `itemId`.
- **Match the permission type to the symptom.** `--type 1` Endpoint is gateway-enforced (missing ⇒ **403**); `--type 2` FrontendAction is SPA-gate-enforced (missing ⇒ control silently hidden); `--type 3` DataProtection controls masking (missing ⇒ redacted data). Most features need the type 1 *and* type 2 permission, plus any `dependentPermissions`.
- **Never fire a create/update/assign-permissions call — CLI or SDK — without a human confirming that specific change first.** See [flows/manage-roles-permissions.md](flows/manage-roles-permissions.md) for the full discipline.
- **OIDC/identity-provider client provisioning is a separate concern**, independent of everything above — it runs through `blocks auth oidc-clients`/`auth idp`, not through roles and permissions.

## Example trigger prompts

- "Only show the delete button to users who have the `order::delete` permission." → Facet 1
- "Hide this whole admin section unless the signed-in user has an admin role." → Facet 1
- "What roles am I allowed to assign to other users?" → Facet 1
- "Show me permissions grouped by severity in a settings panel." → Facet 1
- "Build an admin page where I can create a role and pick which permissions it gets." → Facet 2
- "Create a `content-editor` role from the CLI with these permissions." → Facet 2
- "Users with the `support` role get 403 calling the inventory API — fix the role." → Facet 2; find the `--type 1` permission for that endpoint and grant it (plus its dependencies).
- "Give the `manager` role everything `clouduser` has." → assignable, but push back on scope: propose the least-privilege set for what managers actually do and confirm that list first.
- "Can you just set up a few default roles for my project?" → confirm the exact list with the human first (in chat, or via a reviewed `--dry-run`), then run each `blocks iam roles create`/`assign-permissions` with `--yes` only after they say go — don't auto-provision without that per-change confirmation.
