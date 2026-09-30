# Two worked examples

Both are real workflows, described structurally. Secrets are shown as `__REDACTED__` — a `workflow export` produces exactly that unless `--include-secrets` is passed.

---

## 1. Webhook orchestration — "create a user only if under the seat limit"

A `webhook` trigger fans through checks and ends in either a create call or an error response. This is the shape to copy for "expose one URL that coordinates several Blocks calls."

Flow:

1. **`webhook` (trigger)** — `Create User Webhook`, `httpMethod: POST`, `authType: "blocksAuthorization"`, `authorizationMode: "RolesOnly"`, `roles: { mode: "and", values: ["firmadmin"] }`. The caller's payload is available downstream as `{{$node["Create User Webhook"].json.output.<field>}}`.
2. **`httpRequest` (action)** — `Get Current Subscription`, `GET` a subscriptions endpoint with `authenticationType: "blocksAuthentication"` (delegated token).
3. **`if` (logic)** — `Check If Subscribed`: compares `{{$json.output.data}}` `equals` `null`. `if-false` (has a subscription) continues; `if-true` goes to a `setfield` node that returns `{ isSuccess: false, errors: "NOT_SUBSCRIBED" }`.
4. **`code` (transform)** — `Allowed User Count`: `mode: "each"`, pulls the seat cap out of the subscription: `return { maxQuantity: $json.data.quantities.find(x => x.itemKey == "User").maxQuantity };`.
5. **`httpRequest` (action)** — `Get User Count`: `POST` the IAM users list with a `pageSize: 1` body to read `totalCount`.
6. **`code` (transform)** — `Map User Counts`: combines the two: `return { allowedUserCount: $node["Allowed User Count"]?.json?.maxQuantity ?? 0, userCount: $json.totalCount };`.
7. **`if` (logic)** — `Check If Allowed`: `{{$json.output.userCount}}` `less_than` `{{$json.output.allowedUserCount}}`. `if-true` → create; `if-false` → a `setfield` returning `{ isSuccess: false, errors: "NOT_SUPPORTED" }`.
8. **`httpRequest` (action)** — `Create User`: `POST` IAM create-user, body built from the webhook payload with expressions like `"email": "{{$node["Create User Webhook"].json.output.email}}"` and `"roles": {{$node["Create User Webhook"].json.output.roles}}`.

Patterns worth copying:
- **Branch early, respond with `setfield`.** Each failure path ends in a `setfield` node that returns a small `{ isSuccess, errors }` object, so the webhook's response is meaningful.
- **`code` nodes do the shaping**, `if` nodes do the gating, `httpRequest` nodes do the calls.
- Prefer `authenticationType: "blocksAuthentication"` on the Blocks calls. Where the example used `clientCredential` with an embedded `clientId`/`clientSecret`, that credential is a secret — on export it becomes `__REDACTED__` and must be re-supplied on import.

---

## 2. Data-trigger side-effect — "keep denormalized assignees in sync"

Several `dataGateway` triggers (one per collection/operation) each run a small chain that reads related records and writes derived data back with `dataAction`. This is the shape for "when data changes, maintain something else."

Flow (one representative chain):

1. **`dataGateway` (trigger)** — e.g. `collectionName: "Client"`, `operation: "Inserted"`. Other chains trigger on `Updated`, or on other collections (ScreeningResult, AuditEvent, Report).
2. **`dataAction` (action)** — `getData` to fetch related rows, e.g. clients or assignees, with a `filter` and `getFields`.
3. **`code` (transform)** — compute the assignee set from the fetched rows.
4. **`if` (logic)** — guard, e.g. "assignees changed" / "assignees exist"; skip the write when nothing changed.
5. **`dataAction` (action)** — `updateData` (or `insertData`) to write the derived assignees onto the target collection(s).

Patterns worth copying:
- **One trigger per (collection, operation).** Insert vs Update often need different handling; give each its own chain in the same workflow.
- **`dataAction` for all record I/O**, not `httpRequest` — it targets the Data Gateway directly and its `projectKey`/`projectShortKey` are re-pointed to the destination project on import (pass `--project-slug <slug>` so `projectShortKey` updates too).
- **Guard writes with an `if`** so a change that doesn't affect the derived data doesn't cause a write loop.

---

## Using these

Export either workflow from a project with `blocks logic workflow export <id>` to see the full JSON, then adapt. To load an adapted file into a project:

```
blocks logic workflow import --file my-workflow.json --project-slug <slug> --dry-run --json
blocks logic workflow import --file my-workflow.json --project-slug <slug> --publish --yes --json
```

`import` assigns fresh node ids, rewrites edges, re-points tenant-scoped keys, and (with `--publish`) activates it.
