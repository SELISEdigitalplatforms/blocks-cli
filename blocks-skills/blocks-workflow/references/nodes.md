# Workflow node catalogue

Every node in a workflow file carries `id`, `name`, `category`, `type`, `version` (always `"v1"`), `position:{x,y}`, `parameters:{...}`, `settings:{}`, and optional `pinData`/`handle`. This file lists every `type`, its exact `parameters` fields, allowed values, and output handles.

Categories: `trigger` (entry points), `logic` (branching), `transform` (reshape data), `action` (call something). A workflow has exactly one trigger reached first.

**Expressions** (any string parameter): `{{$json.field}}` = the current item; `{{$node["Node Name"].json.field}}` = a named upstream node's output; inside a Code node, `$json`/`$item`, `$items` (all items), `$node["Name"]`.

**Output handles**: every node emits from a single `source` handle **except** `if`, which emits from `if-true` and `if-false`. Wire handles in `edges[].sourceHandle`.

---

## Triggers (`category: "trigger"`)

### `webhook`
Fires when an HTTP request hits the workflow's webhook URL.
- `httpMethod`: `"GET"|"POST"|"PUT"|"PATCH"|"DELETE"` (default `"POST"`)
- `authType`: e.g. `"none"|"blocksAuthorization"`
- `authorizationMode`: e.g. `"RolesOnly"` when `authType` is `blocksAuthorization`
- `roles`: `{ mode: "and"|"or", values: string[] }`
- `permissions`: `{ mode: "and"|"or", values: string[] }`
- `httpResponseMode`: e.g. `"immediate"|"last"`; `httpResponseData`: e.g. `"all"`
- `organizationId`: string (optional)
- `path`: the webhook path segment (usually the node id)

### `dataGateway`
Fires on a Data Gateway collection change.
- `collectionName`: string (required)
- `schemaName`: string
- `operation`: `"Inserted"|"Updated"|"Deleted"` (required)

### `schedule`
Fires on a cron schedule.
- `triggerInterval`: `"minutes"|"hours"|"days"|"weeks"|"months"|"custom"` (default `"days"`)
- `cronExpression`: string (5- or 6-field)
- interval helpers: `secondsBetweenTriggers`, `minutesBetweenTriggers`, `hoursBetweenTriggers`, `monthsBetweenTriggers` (int)
- time-of-day: `triggerAtHour`, `triggerAtMinute`, `triggerAtDayOfMonth`, `triggerAtWeekdays` (string[])

### `email`
Fires on inbound email to a configured mail server.
- `mailServerConfigurationId`: string (required)
- `testSubject`: string (optional)

---

## Logic (`category: "logic"`)

### `if`  — output handles `if-true` and `if-false`
Branches on one or more conditions.
- `conditionType`: `"all"|"and"|"or"` (all conditions vs any)
- `conditions`: array of `{ left, operator, right, type }`
  - `operator`: `"equals"|"not_equals"|"contains"|"not_contains"|"greater_than"|"less_than"|"greater_or_equal"|"less_or_equal"|"is_true"|"is_false"`
  - `type`: `"string"|"number"|"boolean"|"date_time"|"array"`
  - `left`/`right`: values or expressions, e.g. `"{{$json.output.userCount}}"`

---

## Transform (`category: "transform"`)

### `code`
Runs JavaScript. Returns an object (or array) that becomes the node's output.
- `mode`: `"each"` (run per item) | `"all"` (run once over `$items`)
- `language`: `"js"` (only JS is supported)
- `script`: the code, e.g. `return { total: $json.a + $json.b };`

### `setfield`
Builds/maps an output object without code.
- `mode`: `"manual_mapping"` | `"json"`
- `manualMappingFields`: array of `{ key, value, type }` where `type` is `"string"|"number"|"boolean"|"json"` (used when `mode` is `manual_mapping`)
- `jsonCode`: a JSON string (used when `mode` is `json`)
- `includeOtherFields`: bool; `otherFieldsMode`: `"all"|"include"|"exclude"`; `includedFields`/`excludeFields`: comma-separated field lists

---

## Actions (`category: "action"`)

### `httpRequest`
Calls an HTTP/REST endpoint.
- `httpMethod`: `"GET"|"POST"|"PUT"|"PATCH"|"DELETE"|"HEAD"|"OPTIONS"` (required)
- `url`: string/expression (required)
- `haveQueryParameters`: bool; `queryParameters`: `{ [k]: string }`
- `haveHeaders`: bool; `headers`: `{ [k]: string }` (e.g. `x-blocks-key` — a secret)
- `authenticationType`: `"blocksAuthentication"` (delegated token, no stored secret — **prefer this** for Blocks calls) | `"clientCredential"` | `""`
- `clientId` / `clientSecret` / `clientCredential_composite`: only for `clientCredential` (secrets)
- `haveBody`: bool; `bodyContentType`: `"json"|"xml"|"text"|"html"`; `body`: string/expression

### `dataAction`
CRUD on a Data Gateway collection (GraphQL under the hood). `projectKey` is re-pointed to the destination project on import.
- `actionType`: `"getData"|"insertData"|"updateData"|"deleteData"` (required)
- `collectionName`: string (required); `schemaName`: string; `projectShortKey`: string
- `filter`: `{ [field]: value }` (where conditions); `fieldMapping`: `{ [field]: value }`; `getFields`: string[]
- `rawQueryMode`: bool; `rawQuery`: raw GraphQL string (when `rawQueryMode`)
- `authenticationType`: `"blocksAuthentication"|"clientCredential"`; `clientId`/`clientSecret` for the latter

### `sendMail`
Sends templated email via the Mail service. On import, `EmailTemplate` is namespaced per tenant.
- `template`: mail template id/name (required); `language`: e.g. `"en-US"`
- `to`: string/expression (required)
- `bodyDataContext`: `{ [k]: string }` (template variables)
- `attachments`: string[] (Storage file ids or expressions)

### `agent`
Invokes an AI Agent widget.
- `agentId` / `widgetId`: string (widget required)
- `input`: string/expression (required); `apiBaseUrl`: string

### `proxy`
Routes a request through the Proxy service (no upstream credential in the node).
- `slug`: string (required); `routeMethod`: HTTP method (required); `routePath`: route template with `{name}` segments
- `pathParams`: `{ [name]: expression }`; `haveQuery`: bool; `queryParams`: `{ [k]: expression }`; `haveBody`: bool; `body`: JSON/expression

---

## Minimal example

A webhook that branches on a number and calls one of two endpoints:

```json
{
  "name": "Gate By Count",
  "settings": {},
  "nodes": [
    { "id": "n1", "name": "Hook", "category": "trigger", "type": "webhook", "version": "v1",
      "position": { "x": 0, "y": 0 },
      "parameters": { "httpMethod": "POST", "authType": "none", "path": "n1" },
      "settings": {}, "pinData": null },
    { "id": "n2", "name": "Check", "category": "logic", "type": "if", "version": "v1",
      "position": { "x": 260, "y": 0 },
      "parameters": { "conditionType": "all",
        "conditions": [ { "left": "{{$json.output.count}}", "operator": "less_than", "right": "10", "type": "number" } ] },
      "settings": {}, "pinData": null },
    { "id": "n3", "name": "Allow", "category": "action", "type": "httpRequest", "version": "v1",
      "position": { "x": 520, "y": -80 },
      "parameters": { "httpMethod": "POST", "url": "https://api.example.com/allow",
        "authenticationType": "blocksAuthentication", "haveBody": false },
      "settings": {}, "pinData": null }
  ],
  "edges": [
    { "id": "xy-edge__n1-n2", "source": "n1", "target": "n2", "sourceHandle": "source", "targetHandle": "target" },
    { "id": "xy-edge__n2-n3", "source": "n2", "target": "n3", "sourceHandle": "if-true", "targetHandle": "target" }
  ]
}
```

Node ids here are illustrative; `blocks logic workflow import` assigns fresh ids and rewrites the edges to match, so you never have to make ids globally unique yourself — just keep them consistent within the file.
