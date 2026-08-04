---
name: blocks-data-gateway-configuration
description: "Configure the data model of a SELISE Blocks project through the blocks-os CLI — never raw fetch/curl against api.seliseblocks.com. Covers the tenant's data-source configuration (blocks-os data config get/create/update — check this FIRST, defaults to Blocks-managed storage), validating and pushing schemas (data schema list/pull/push, plus granular data schema get/get-by-name/aggregation/change-logs/delete/fields/info *), deploying data-access policies (data rules pull/deploy, plus single-item data rules policy get/delete), field-level validation rules (data validation list/get/by-schema/by-schema-field/save/delete), and reloading so changes go live (data reload). Use whenever the user wants to define, edit, secure, validate, or reload the DATA MODEL of a Blocks project — 'add a field to my schema', 'push my schema changes', 'set data-access policies', 'add a validation rule to a field', 'reload the schema', 'pull the schemas from the project', 'what database is this project using'. Also clarifies what this skill does NOT cover: mock-data cleanup and cross-project schema export/import have no CLI or SDK support today (portal-only if available at all) — do not invent commands for them. AI-assisted regex field validation is the one exception that goes through the @seliseblocks/client SDK instead of the CLI. This is the admin/config half; for GraphQL CRUD against the resulting schemas from app code, that's a job for @seliseblocks/client directly (not covered by this skill)."
---

# Blocks Data — Gateway Configuration

The Data schema/rules model of a Blocks project is configured entirely through the `blocks-os` CLI now — there is no supported reason to hand-roll `fetch`/`curl` calls against `api.seliseblocks.com/data/v4` anymore. The CLI reads and writes local files under `blocks/data/` and talks to the Data service for you.

**Prerequisite:** `blocks-os init` has been run (creates `blocks/data/schemas/` and `blocks/data/rules.json`) and a project is selected (`blocks-os use <tenantId>`). If either is missing, or auth state is unknown, run the **[blocks-onboarding](../blocks-onboarding/SKILL.md)** skill first — it covers `auth status` probing, login, and project selection in detail; this skill assumes that's already done.

## Check the data-source configuration first

Before touching schemas, confirm what database actually backs this project's Data Gateway:

```bash
blocks-os data config get --json
```

By default every Blocks project runs on **Blocks-managed storage** — most of the time this is the only data-source command you'll ever need, just to confirm it. Only reach for the mutating commands below if the user explicitly wants to point the gateway at their own external database — this is a rare, deliberate action, not a routine step:

```bash
blocks-os data config create --connection-string "<connection string>" --database-name "<name>" --dry-run --json
blocks-os data config create --connection-string "<connection string>" --database-name "<name>" --yes --json

blocks-os data config update --item-id <id> --connection-string "<new connection string>" --dry-run --json
blocks-os data config update --item-id <id> --connection-string "<new connection string>" --yes --json
```

Treat `--connection-string` as a secret: never print it back unredacted, and don't log it outside the command's own `--dry-run` preview (which redacts it).

## Probe first, ask second

Don't assume the local workspace matches the cloud project. Before editing anything, find out what's actually there:

```bash
blocks-os data schema list --json     # what schemas exist in the selected project (read-only)
blocks-os data schema pull --json     # sync them into blocks/data/schemas/*.json locally
blocks-os data rules pull --json      # sync data-access policies into blocks/data/rules.json
```

Pulling before editing avoids clobbering schema changes someone else made in the portal or another session.

## Workflow: define or edit a schema

1. **Pull current state** (above), so local files reflect the project.
2. **Edit** the relevant JSON file(s) under `blocks/data/schemas/` — add/rename fields, change types, add a new schema file. This is plain file editing; there's no *file-oriented* CLI subcommand for individual field edits (`data schema push` always sends the whole schema), you edit the JSON directly. (`data schema fields` exists as a raw API alternative that adds/updates fields on an existing schema without touching the local file — see "More granular Schema commands" below — but for the local-file workflow described here, just edit the JSON.)
3. **Validate locally, no API call:**
   ```bash
   blocks-os data validate --json
   ```
   Fix anything it flags before going further — this catches malformed schema/rules JSON before it reaches the network.
4. **Dry-run the push** to see exactly what would change (create vs. update, which schemas):
   ```bash
   blocks-os data schema push --dry-run --json
   ```
5. **Get user approval**, then push for real:
   ```bash
   blocks-os data schema push --yes --json
   ```
   This is mutating — POST for new schemas, PUT for existing ones (`/data/v4/schemas/define` under the hood). Never skip straight to `--yes`.
6. **Reload so it goes live.** Schema/rule edits are staged until reload succeeds — the runtime gateway doesn't see them before this:
   ```bash
   blocks-os data reload --dry-run --json
   blocks-os data reload --yes --json
   ```

## Workflow: data-access policies / schema security

Same shape as schemas, in `blocks/data/rules.json`:

```bash
blocks-os data rules pull --json                 # get current policies locally
# edit blocks/data/rules.json
blocks-os data validate --json                   # local-only check
blocks-os data rules deploy --dry-run --json     # preview
blocks-os data rules deploy --yes --json         # apply, after approval
blocks-os data reload --dry-run --json           # then reload so it's live
blocks-os data reload --yes --json
```

`data rules deploy` applies schema security and data-access policies together — there's no finer-grained CLI split between "field access level" and "policy rule"; both live in `rules.json`.

For a single policy without touching the rest of `rules.json`, use the granular commands instead of a full pull/edit/deploy round-trip:

```bash
blocks-os data rules policy get <schemaName> --json          # read-only, all policies for one schema
blocks-os data rules policy delete <itemId> --dry-run --json
blocks-os data rules policy delete <itemId> --yes --json
```

There's no single-policy `create`/`update` command — those go through `data rules deploy` (it POSTs new policies and PUTs existing ones from `rules.json`).

## Workflow: field-level validation rules

Data validations are a separate resource from schema field types — a schema field's `type` says *what kind* of value it holds, a validation rule says *what values are acceptable*. There's no file-oriented pull/push for these yet (no `blocks/data/validations.json`); work with them directly:

```bash
blocks-os data validation by-schema <schemaId> --json                        # everything for one schema
blocks-os data validation by-schema-field <schemaId> <fieldName> --json      # one field's rule
blocks-os data validation list --schema-id <schemaId> --json                 # paginated browse
```

Create or update a rule (upsert: omit `--item-id` to create, pass it to update). The `validations` array itself has no scalar-flag equivalent — pass it via `--body`/`--file`:

```bash
blocks-os data validation save --schema-id <schemaId> --field-name email \
  --body '{"validations":[{"type":1,"value":"^[^@]+@[^@]+\\.[^@]+$","errorMessage":"Enter a valid email","isActive":true}]}' \
  --dry-run --json
blocks-os data validation save --schema-id <schemaId> --field-name email \
  --body '{"validations":[{"type":1,"value":"^[^@]+@[^@]+\\.[^@]+$","errorMessage":"Enter a valid email","isActive":true}]}' \
  --yes --json

blocks-os data validation delete <validationId> --dry-run --json
blocks-os data validation delete <validationId> --yes --json
```

The API doesn't publish named constants for the `type` enum in its schema — if the user needs a specific validation type and you're not sure of its numeric value, run `data validation by-schema-field` on a field with a known-working rule (e.g. one set up in the portal) to see the value in context, rather than guessing.

## More granular Schema commands

`data schema list/pull/push` cover the everyday file-based workflow above. For one-off lookups or advanced schema metadata, these go straight to the API without touching local files:

```bash
blocks-os data schema get <id> --json                    # single schema by id
blocks-os data schema get-by-name <schemaName> --json    # full field detail by collection name
blocks-os data schema aggregation --json                  # schemas + access-level summary (Public/User/Custom x Read/Write/Edit/Delete)
blocks-os data schema change-logs --json                  # unadapted change logs; data reload clears these
blocks-os data schema delete <id> --dry-run --json        # irreversible
blocks-os data schema delete <id> --yes --json
```

`data schema info list/save/update` and `data schema fields` are the two-step alternative to `data schema push` (metadata first, fields second) — prefer the file-based `push` workflow above for normal schema authoring; reach for these only if the user specifically wants to add fields to an existing schema without touching its full JSON file, or needs the raw `/schemas/info` metadata-only shape.

## `--dry-run` before `--yes` — always

Every mutating command here (`data config create/update`, `data schema push`, `data schema delete`, `data schema fields`, `data schema info save/update`, `data rules deploy`, `data rules policy delete`, `data validation save/delete`, `data reload`) supports `--dry-run`. Run it, show the user what it says it will do, and only add `--yes` after they approve. This is not optional caution — it's the standard pattern across every `blocks-os` mutation, not unique to this skill.

## What this skill does NOT cover (and why)

Two things the old, pre-CLI version of this skill used to handle no longer have any supported path — do not paper over the gap by inventing a command or improvising a raw API call:

- **Mock/sample data cleanup.** There is no `blocks-os data mock*` command, and the SDK's `data.utilities.mockData()` (in `@seliseblocks/client`) is **read-only** — it inventories mock data, it does not delete it. If a user asks to "wipe the demo data" or "clean up sample records," tell them plainly: this isn't exposed in the current CLI or SDK. Check whether the OS portal (`https://os.seliseblocks.com`) has a Data-section control for it; if not, there's no way to do this today short of deleting real records through generated GraphQL mutations one at a time, which is not the same thing and should not be presented as equivalent.
- **Schema export/import between projects** (e.g. cloning a dev project's data model into staging). No CLI command and no SDK method exist for this. If a user wants to copy a data model between projects, the honest answer is: not supported by current tooling. Check the OS portal for a manual option; otherwise the only fallback is manually recreating schemas in the target project's `blocks/data/schemas/` and pushing them — which is a manual reconstruction, not a real export/import, and should be described as such.

Don't guess at endpoint paths or reconstruct the old skill's HTTP calls for either of these — that old skill (`blocks-skills/skills/blocks-data-gateway-configuration/`) is retained purely as historical reference and its REST patterns are not the tooling this project uses anymore.

## The one thing that goes through the SDK, not the CLI

**AI-generated regex for field validation** is real, but it lives only in `@seliseblocks/client`, not in `blocks-os`. There's no CLI command for it because it's a single request/response utility call better suited to being scripted inline in app code than wrapped as a terminal command:

```ts
import { createBlocksClient } from "@seliseblocks/client";

const blocks = createBlocksClient({
  apiUrl: "https://api.seliseblocks.com",
  xBlocksKey: "<project-tenant-id>",
  accessToken: () => currentAccessToken
});

const suggestion = await blocks.data.utilities.generateRegex({
  description: "a valid US phone number, digits only, 10 characters"
});
```

If a user wants a regex suggestion for a field, write a small one-off script using the SDK like the above rather than trying to shoehorn it into a `blocks-os` invocation — the CLI genuinely has no equivalent, this isn't an oversight to work around. Once you have the pattern, put it into the relevant field's validation in `blocks/data/schemas/<Schema>.json` and continue with the normal push/reload workflow above.

## Gotchas

- **Reload or it didn't happen.** `data schema push` and `data rules deploy` stage changes; `data reload` is what makes them visible to the runtime gateway (and to any app querying it via `@seliseblocks/client`).
- **Pull before you edit** if you're not sure local files are current — someone may have changed the schema in the portal since your last pull.
- **`data validate` is local-only** — it does not confirm the push will succeed against the server, only that the JSON is well-formed. Still run `--dry-run` on the actual push/deploy/reload commands.
- **Don't invent mock-data-delete or schema-export commands.** They don't exist in the CLI or the SDK today — say so, check the portal, don't fake it with unrelated calls.
- **Never define platform-managed system fields** (`ItemId`, `CreatedDate`, `CreatedBy`, `LastUpdatedDate`, `LastUpdatedBy`, `Language`, `OrganizationId`, `Tags`) in your schema JSON — Blocks adds these to every entity schema automatically.
- **Check `data config get` before assuming Blocks-managed storage.** Most projects use it, but don't state it as fact without checking — and never create/update a data source configuration without explicit user intent, it repoints the project at a different database.
- **`data validation save` requires a `validations` array via `--body`/`--file`.** There's no flag for it — the command errors out with a clear message if it's missing, don't try to work around that by guessing a flag name.

## Example trigger prompts

- "Add an `email` field to my `Customer` schema and push it."
- "Pull the current schemas so I can see what's already defined."
- "Validate my local schema files before I push."
- "Set up a data-access policy so only admins can delete `Order` records."
- "Reload the data schema, I just pushed some field changes."
- "Suggest a regex for validating a postal code field."
- "What database is this project actually using?" → `data config get`.
- "Add a validation rule so the `phone` field only accepts digits." → `data validation save`.
- "What validation rules exist on the `Order` schema?" → `data validation by-schema`.
- "Delete this one data-access policy without touching the rest of my rules file." → `data rules policy delete`.
- "Can you wipe the demo/sample data from my project?" → explain this isn't supported by the CLI or SDK today; point to the portal.
- "Copy my dev project's schemas over to staging." → explain export/import isn't supported by current tooling; point to the portal or manual recreation.
