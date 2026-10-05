# Flow: author a workflow and load it into a project

When to use: the user wants a new backend behaviour (data trigger, webhook, schedule, orchestration) built as a workflow, or wants to move/adapt an existing one.

Preconditions:
- `blocks --version` works and the user is logged in (`blocks auth status --json`).
- A project is resolved (the account's saved selection, or pass `--project <tenantId>`). Use blocks-bootstrap if context is unknown.

## 1. Confirm a workflow is the right tool

Apply the decision list in SKILL.md. If a single SDK call or a Data Gateway rule covers it, do that instead. Proceed only for event-driven glue that would otherwise need a backend.

## 2. Design the graph

Decide the one trigger (`webhook` / `dataGateway` / `schedule` / `email`), then the chain of `logic` / `transform` / `action` nodes. Sketch nodes and how they wire (which `if` branch goes where). See references/nodes.md for every type's parameters and references/examples.md for two real shapes.

## 3. Write the JSON

Produce a `{ name, settings, nodes[], edges[] }` file. Rules:
- Give every node an `id` that is consistent within the file; `import` will assign fresh global ids and rewrite edges, so they only need to be unique within this file.
- `version` is `"v1"` on every node.
- Wire edges from `source`, except the `if` node's `if-true` / `if-false`.
- Prefer `authenticationType: "blocksAuthentication"` on Blocks `httpRequest`/`dataAction` calls so no secret is stored. If you must embed a `clientSecret`, know it lands in the file in cleartext.

## 4. Dry-run the import

```
blocks logic workflow import --file my-workflow.json --project-slug <slug> --dry-run --json
```

Read the output: `action` (create vs update-by-name), `nodeCount`/`edgeCount`, and any `warnings` (dropped nodes/edges, unresolved `projectShortKey`, or `__REDACTED__` placeholders that must be filled first). Fix the file until the dry-run is clean.

## 5. Import (and optionally publish)

```
blocks logic workflow import --file my-workflow.json --project-slug <slug> --publish --yes --json
```

Without `--publish` the workflow is created but **inactive**; publish later with `blocks logic workflow publish <id> --dry-run` then `--yes`.

## 6. Verify

- `blocks logic workflow list --search "<name>" --json` — confirm it exists and its published state.
- `blocks logic workflow get <id> --json` — confirm the graph imported as intended.
- For a `webhook` workflow, trigger it and check the result. For a `dataGateway` or `schedule` workflow, cause the event / wait for the schedule.
- To hand the workflow to another project or the repo: `blocks logic workflow export <id> --json` (secrets redacted).

## Branches

- **Updating an existing workflow:** keep the same `name`; `import` will update the same-named workflow in place rather than create a duplicate.
- **Moving between projects:** export from the source, then import into the destination with `--project-slug <slug>` so tenant-scoped keys re-point correctly.
- **Turning one off:** `blocks logic workflow unpublish <id>` keeps the draft; re-publish to reactivate.

## Gotchas

- Import matches destination workflows by name, never by the file's id.
- A `projectShortKey` reference only updates when `--project-slug <slug>` is supplied.
- `dataAction` / `dataGateway` / `sendMail` nodes have `projectKey` re-pointed automatically; `sendMail` templates are namespaced per tenant on import.
