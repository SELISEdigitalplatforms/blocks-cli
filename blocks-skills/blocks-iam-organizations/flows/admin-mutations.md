# Flow: Admin-CRUD surface — confirm the exact change first

These mutate tenant-level state. Build them as an explicit feature in an admin settings screen (SDK), or run them as an operator from a terminal with a reviewed `--dry-run` (CLI). Both surfaces exist and are equally real — see "The platform boundary" in [SKILL.md](../SKILL.md).

## SDK methods

### `organizations.list(query)` / `organizations.get(id)` — browse and inspect

Read-only, so no confirmation is needed to call them — but they're part of the admin org-management surface (browsing arbitrary orgs, not just "my own"), so gate the screen itself behind whatever admin permission the app already checks. Typical use: an org-picker/detail view feeding into an edit form, populated before a `create`/`update` call.

```ts
const page = await blocksClient.iam.organizations.list({ Page: 1, PageSize: 20, "Filter.Name": search });
const org = await blocksClient.iam.organizations.get(organizationId);
```

### `organizations.create(request)` / `organizations.update(id, request)`

Create/edit an organization's record (name, description, contact info, branding, addresses, default roles/permissions for new members, etc. — verify current field names against what the admin UI/API actually accepts rather than assuming they haven't changed).

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

Project/org-wide policy, including multi-org enablement. Read the current config first, show the user the diff of what would change, then save.

```ts
const current = await blocksClient.iam.organizations.getConfig();
// ...user reviews current vs. proposed, confirms...
await blocksClient.iam.organizations.saveConfig({
  ...current,
  isMultiOrgEnabled: true
});
```

### `signupSettings.save(request)` — save signup policy

Same confirm-first rule: this changes what the public signup screen allows for every future visitor, so restate the exact policy change (e.g., "turn on org creation from signup") before calling.

```ts
await blocksClient.iam.signupSettings.save({
  ...currentSettings,
  allowOrgCreationFromSignup: true
});
```

## CLI surface — scripting/inspection, outside an app UI

For anything that isn't a feature inside a running Blocks app (one-off lookups, ops scripts, CI checks), the `blocks` CLI has a matching, project-scoped command for every SDK method above except `switchOrganization` (see [read-and-switch.md](read-and-switch.md)). Every command below requires a project already selected (`blocks use <tenantId>`) — they all call IAM through an impersonated project token via `selectedProject()`, the same tenant scoping the SDK calls get from the app's own session.

| CLI command | Maps to | Notes |
|---|---|---|
| `blocks iam organizations list` | `organizations.list()` | `--search`, `--is-disabled`, `--parent-organization-id`, `--ids <a,b>`, `--page`, `--page-size`, `--sort-by`, `--sort-desc`. Read-only. |
| `blocks iam organizations get <id>` (or `--id`) | `organizations.get(id)` | Read-only. |
| `blocks iam organizations my` | `organizations.my()` | Read-only. |
| `blocks iam organizations create --name <n> [...]` | `organizations.create()` | `--name` (required), `--description`, `--email`, `--phone-number`, `--website-url`, `--default-permissions`, `--default-roles`, or a full `--body '<json>'`/`--file <path.json>`. Mutation. |
| `blocks iam organizations update <id> [...]` | `organizations.update(id, ...)` | `--name`, `--description`, `--email`, `--phone-number`, `--website-url`, `--currency`, `--industry`, `--locale`, `--time-zone`, `--is-enabled`, or `--body`/`--file`. Mutation. |
| `blocks iam organizations config get` | `organizations.getConfig()` | Read-only. |
| `blocks iam organizations config save [...]` | `organizations.saveConfig()` | `--multi-org-enabled`, `--consent-for-multi-org-enable`, `--allow-org-creation-from-signup`, `--allow-org-creation-from-portal`, `--allow-org-creation-from-cloud`, `--allow-org-creation-from-construct`, or `--body`/`--file`. Mutation. |
| `blocks iam signup-settings get` | `signupSettings.get()` | Read-only. |
| `blocks iam signup-settings save [...]` | `signupSettings.save()` | `--email-password-signup`, `--sso-signup`, `--default-permissions`, `--default-roles`, or `--body`/`--file`. Mutation. |

```bash
blocks use <tenantId>                              # select the project once per session
blocks iam organizations list --search acme --json
blocks iam organizations config get --json
blocks iam organizations config save --multi-org-enabled --dry-run   # review the request body first
blocks iam organizations config save --multi-org-enabled --yes       # only after the user confirms
```

Every mutating command (`create`, `update`, `config save`, `signup-settings save`) supports `--dry-run` (prints the resolved request body without calling the API) and requires either `--yes` or an interactive `yes` at a confirmation prompt to actually run — the same "state the exact change, get an explicit go-ahead" discipline as the SDK guidance above, just enforced by the CLI itself instead of app code you write.

## Gotchas

- **The CLI has real organization/signup-settings commands** — don't tell a user there's no `blocks` command for organizations; there is, it's just project-scoped and separate from the SDK path used inside an app.
- **Confirm the payload, not just the intent**, before any `create`/`update`/`saveConfig`/`signupSettings.save` call — SDK or CLI — restate which organization and which fields are changing, old value vs. new, and wait for a clear yes. On the CLI this means running with `--dry-run` first and only adding `--yes` after that review.
- **These are legitimate app/operator features, not agent shortcuts.** It's fine to build a "Create Organization" admin screen with a confirm dialog, or run the CLI command yourself with a human's go-ahead — that's the intended use. It's not fine for an agent to call `organizations.create`/`saveConfig` (CLI or SDK) on its own initiative (e.g., to "set things up" for a demo) without that human-in-the-loop step.
- **Different response shapes per call** — `my()`/`list()` return an array-shaped payload, `get(id)` returns a single organization, `create` returns an id. Don't assume a single envelope shape across all of them; check the actual response before wiring UI to a field path.
