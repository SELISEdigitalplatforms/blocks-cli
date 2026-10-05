---
name: blocks-workflow
description: "Design SELISE Blocks Workflows and manage them from the terminal with `blocks logic workflow list|get|save|delete|import|export|publish|unpublish`. Covers authoring a workflow graph as JSON (triggers, if/code/set-field, http/data/mail actions), importing it into a project with `logic workflow import [--publish]`, exporting with secrets redacted, and activating with `logic workflow publish`. Use to build event-driven backend logic — data triggers, webhooks, schedules — without standing up a separate backend, and to judge when a workflow is the right tool versus when it is not. Not for runtime record CRUD (blocks-data-gateway-crud) or sending mail from app code (blocks-mail)."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state.

# Blocks Workflow

For CLI work, use blocks-bootstrap first when account or project context is unknown. Workflow commands must not choose or repair authentication context as a side effect.

A **workflow** is a graph of nodes that runs on the Workflow service. It exists so an app can get backend behaviour — react to data changes, expose a webhook, run on a schedule, call other services — **without standing up a separate backend app**. The whole surface is CLI + JSON: there is no SDK for authoring workflows (a deployed app never edits its own workflows). This skill is how an agent designs a workflow and loads it into a project.

## Decide first: is a workflow the right tool?

Reach for a workflow when the job is **event-driven glue that would otherwise need a backend service**:

- React to Data Gateway changes — on insert/update/delete of a collection, do something (the `dataGateway` trigger).
- Expose a **webhook** endpoint that orchestrates several Blocks calls (IAM, Data, Mail, Storage) behind one URL.
- Run work on a **schedule** (cron).
- Conditional fan-out / light integration with an external API: call, transform, branch, write back.

Do **not** use a workflow for:

- Pure UI/frontend logic, or a single call the app can make inline with the SDK (that's blocks-data-gateway-crud, blocks-mail, etc.).
- Heavy, long-running, or high-throughput compute; anything needing libraries beyond the Code node's JavaScript sandbox.
- Strong-consistency, transactional multi-step logic.
- Low-latency synchronous request paths where an extra hop matters.
- Something a Data Gateway validation rule or an IAM permission already enforces.

When it's a close call, prefer the smallest thing that works: a rule or an SDK call over a workflow, and a workflow over a new backend service.

## The authoring model

A workflow file is exactly `{ name, settings, nodes[], edges[] }` — the same shape the portal's editor exports and imports, so a file exported from one project imports into another.

- **nodes[]** — each node has `id`, `name`, `category` (`trigger` | `logic` | `transform` | `action`), `type`, `version` (always `"v1"`), `position:{x,y}`, and a `parameters` object whose fields depend on the type.
- **edges[]** — `{ id, source, target, sourceHandle, targetHandle }` wire node outputs to inputs. Every node emits from `source` except the `if` node, which has two handles: `if-true` and `if-false`.
- **expressions** — parameters interpolate upstream data with `{{$json.field}}` (the current item), `{{$node["Node Name"].json.field}}` (a named upstream node), and `$items` for the full set inside a Code node.

There are **12 node types**. The full catalogue — every type, its exact `parameters` fields, allowed values, and output handles — is in [references/nodes.md](references/nodes.md). Two complete, annotated real workflows (a webhook orchestration and a data-trigger side-effect) are in [references/examples.md](references/examples.md). Read those before hand-writing a graph.

## Command surface

All workflow commands are project-scoped (they use the resolved project selection or `--project <tenantId>`). Reads take no confirmation; every mutation takes `--dry-run` first, then `--yes`.

- **`blocks logic workflow list [--search <q>] [--is-published[=false]] [--page-number 1] [--page-size 20] [--json]`** — read-only.
- **`blocks logic workflow get <id> [--json]`** — read-only; returns the full node/edge graph.
- **`blocks logic workflow import --file <path.json> [--publish] [--project-slug <slug>] [--name <n>] [--dry-run] [--yes] [--json]`** — the main authoring path. Validates the file, assigns fresh node ids, rewrites edges, and re-points tenant-scoped keys at this project. It upserts **by name** (updates a same-named workflow, otherwise creates), never trusting the file's own id. `--publish` activates it in the same step.
- **`blocks logic workflow export [<id>] [--all] [--include-secrets] [--out <path>] [--out-dir <dir>] [--json]`** — writes portable JSON that `import` can consume. Redacts secrets by default.
- **`blocks logic workflow save [--item-id <id>] [--name <n>] [--description <d>] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]`** — low-level create/update from a payload; omit `--item-id` to create, pass it to update. Prefer `import` for whole exported files (it does the id-remap and tenant rewrite; `save` does not).
- **`blocks logic workflow publish <id> [--name <n>] [--description <d>] [--dry-run] [--yes] [--json]`** — publishes a new version, which is what actually **activates** the workflow: its webhook becomes reachable and schedule triggers are registered.
- **`blocks logic workflow unpublish <id> [--dry-run] [--yes] [--json]`** — takes it out of service; the draft is kept, re-publish to reactivate.

The normal loop is: design the graph → write the JSON → `logic workflow import --file ... --dry-run` → `--yes` → `logic workflow publish`. See [flows/author-and-import.md](flows/author-and-import.md).

## Secrets

A workflow export embeds live credentials in cleartext — client secrets, the `x-blocks-key` header value, composite client credentials sit inside node `parameters`. Two consequences:

- **Export redacts by default.** `workflow export` replaces those values with `__REDACTED__`. Use `--include-secrets` only when you deliberately want a runnable copy, and never commit that file.
- **Prefer delegated auth over embedded secrets when authoring.** For `httpRequest`/`dataAction` nodes calling Blocks services, use `authenticationType: "blocksAuthentication"` (a delegated token, no stored secret) instead of `clientCredential` with a hard-coded id/secret wherever the call allows it. If a file still carries `__REDACTED__` placeholders, `import` warns — fill them in before the workflow will run.

## Mutation discipline

`import`, `save`, `delete`, `publish`, `unpublish` all mutate. Same two gates as the rest of this CLI: `--dry-run` prints exactly what would happen and makes no network call; without it, either `--yes` or an interactive "yes" is required. Always dry-run first. `list`/`get`/`export` never mutate the server.

## Gotchas

- **A created or imported workflow is inactive.** It won't run until `logic workflow publish`. Import with `--publish` to do both at once.
- **Import matches by name, not id.** A file's node/workflow ids belong to whatever project produced it; `import` assigns fresh ids and finds the destination workflow by name. Two workflows you want kept separate must have different names.
- **Tenant-scoped nodes get re-pointed on import.** `dataAction`, `dataGateway`, and `sendMail` nodes have their `projectKey` set to the destination project automatically; `sendMail` templates are namespaced per tenant. A `projectShortKey` reference can only be updated if you pass `--project-slug <slug>` — otherwise `import` warns and leaves it.
- **`version` is always `"v1"`.** Don't invent other version strings; the engine matches nodes by `type`, and every real node is `v1`.
- **The `if` node is the only branch.** Wire its `if-true`/`if-false` handles; all other nodes flow from `source`.
- **Dropped nodes/edges are reported, not fatal.** Import counts and skips malformed nodes and dangling edges; check the `issues`/`warnings` in the output.

## Example trigger prompts

- "When a row is added to the Orders collection, call our fulfilment API." → a `dataGateway` (Inserted) trigger → `httpRequest` action; author JSON, `logic workflow import --file ... --publish --dry-run`, then `--yes`.
- "Give me a webhook that creates a user only if we're under our seat limit." → `webhook` trigger → `httpRequest`/`code`/`if` → `httpRequest` create; see references/examples.md.
- "Email a daily summary every morning." → `schedule` trigger → `dataAction` read → `sendMail`.
- "Should this be a workflow or app code?" → apply the decision list above; a single SDK call or a data rule is usually better than a workflow.
- "Back up all our workflows to the repo." → `blocks logic workflow export --all --json` (secrets redacted by default).
- "Move this workflow to the staging project." → `blocks logic workflow export <id>`, then in the staging project `blocks logic workflow import --file <path> --project-slug <slug>`.
- "Turn this workflow off without deleting it." → `blocks logic workflow unpublish <id> --dry-run`, then `--yes`.
