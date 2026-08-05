---
name: blocks-iam-organizations
description: "Work with organizations (multi-tenant workspaces) via `iam.organizations`/`iam.signupSettings`/`auth.switchOrganization` (SDK, in-app) or `blocks iam organizations *`/`iam signup-settings *` (CLI, project-scoped, `--dry-run`→`--yes`) — never raw fetch/curl. Covers the org switcher, switching active org context (SDK/app-only, no CLI equivalent), public signup policy, and — human-confirmed only — creating/editing organizations and org/signup config. Use for 'org switcher', 'switch organization', 'multi-org', 'create/update an organization', 'organization settings', 'signup settings'. Users/roles within an org are blocks-iam-users/blocks-iam-access-control; SSO/OIDC client setup is blocks-onboarding, portal-optional now."
---

# Blocks IAM — Organizations

Organizations are the tenancy/workspace unit inside a Blocks project. Two equally real surfaces exist for managing them:

- **Inside a Blocks app** — `@seliseblocks/client` SDK calls from app code (`blocksClient` in `src/lib/blocks/client.ts`, from `blocks new web`). Never write raw `fetch`/`curl` against Blocks APIs.
- **Outside an app UI** — scripting, one-off inspection, CI, an ops task — the `blocks` CLI has a real, project-scoped command surface for the same operations: `blocks iam organizations list/get/create/update/my/config get/config save` and `blocks iam signup-settings get/save`.

The one thing neither surface papers over as a gap is `auth.switchOrganization` — there is no `blocks iam organizations switch` or similar; switching the *active session's* org context only makes sense from inside the app that owns that session, so it stays SDK-only.

**Prerequisite:** the app is a `blocks new web` scaffold with a project selected. If auth/project state is unknown, run the blocks-onboarding skill first.

## The platform boundary — read this before writing any admin-CRUD call

Full organization management (create, update, config, signup-settings) **is** exposed today, on both surfaces above. What's restricted isn't the surface but *who authorizes a mutation and when* — organizations are a tenant-isolation boundary, so creating or reconfiguring them carries the same "human explicitly directs this specific change" discipline as the portal-only OIDC provisioning in blocks-onboarding, just enforced on two different mechanisms (SDK call vs. CLI command) instead of one.

Concretely: **before wiring up or invoking any `create`/`update`/`saveConfig`/`save` call — SDK or CLI — restate the exact change back to the user in plain terms (which organization, which fields, old value vs. new value) and get an explicit go-ahead.** Never something an agent calls on its own initiative, in an unattended script, or as a side effect of some other task.

## Two flows

- **[flows/read-and-switch.md](flows/read-and-switch.md)** — the org switcher (`organizations.my`), switching active org context (`auth.switchOrganization`, SDK-only), and public signup policy (`signupSettings.get`). Safe, no special caveat.
- **[flows/admin-mutations.md](flows/admin-mutations.md)** — creating/editing organizations, org-level config, and signup policy, on both the SDK and CLI surfaces, including the full CLI command reference. Sensitive — human-confirmed only.

## Gotchas

- **The CLI has real organization/signup-settings commands** — don't tell a user there's no `blocks` command for organizations.
- **The one genuine gap is `switchOrganization`** — SDK/app-only, no CLI equivalent, don't invent one.
- **Confirm the payload, not just the intent**, before any mutating call — SDK or CLI. See [flows/admin-mutations.md](flows/admin-mutations.md) for the full discipline.
- **Multi-org must be enabled** (`isMultiOrgEnabled`) for switching orgs to be meaningful — check this first if a user reports "switching doesn't do anything."

## Example trigger prompts

- "Add an org switcher to the sidebar using the current user's organizations." → read-and-switch
- "Let a multi-org user switch which organization they're working in." → read-and-switch
- "Show the tenant's signup policy on our public signup page." → read-and-switch
- "Build an admin screen to create a new organization." → admin-mutations (confirm the fields with the user before calling `create`)
- "Turn on multi-org for this project." → admin-mutations (read `getConfig`/`config get` first, confirm the change, then save)
- "Is there a `blocks` command to list organizations?" → yes, `blocks iam organizations list` (project-scoped, requires `blocks use <tenantId>` first); use the SDK instead only when the ask is a feature inside the app itself.
- "Is there a CLI way to switch which organization I'm working in?" → no, that's the one gap — `auth.switchOrganization` is SDK/app-only since it mutates the calling session's own tokens.
