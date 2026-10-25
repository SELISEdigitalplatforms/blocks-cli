---
name: blocks-proxy
description: "Call a third-party API from app code without shipping its URL or keys: configure a Blocks Logic proxy with `blocks logic proxy *` (upstream, declared routes, injected headers with `{{$VAR.name}}` secrets, who-can-call access, timeout/retry/circuit breaker, rate limit, OpenAPI import), then call it with the SDK's `blocksClient.logic.proxy.request()`. Also covers testing, version history/revert and request logs. Use for credentialed upstream passthrough; custom code belongs in blocks-functions, event graphs in blocks-workflow."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Proxy

A **proxy** is a named gateway route in front of one upstream API. The app calls the proxy; Blocks checks who is calling, rebuilds the request against the stored upstream, adds the configured headers/query/body fields (resolving secrets server-side), forwards it, and logs the exchange. The browser never sees the upstream URL or its key.

- **CLI — `blocks logic proxy *`** — configure, test, inspect, revert. **No SDK equivalent.**
- **SDK — `blocksClient.logic.proxy.*`** — call a configured proxy: `request()`, `requestRaw()`, `url()`.

For CLI work, use blocks-bootstrap first when account or project context is unknown.

**Local snapshot:** `blocks/logic/proxies.json` (from `blocks pull --only logic`) lists the project's proxies with upstreams redacted. Read it before listing; check `_meta.tenantId` / `_meta.pulledAt`.

## Configure

Simple proxy — one upstream, a few methods:

```bash
blocks logic proxy create --name "Weather" --upstream https://api.weather.example --methods GET --dry-run --json
blocks logic proxy create --name "Weather" --upstream https://api.weather.example --methods GET --yes --json   # note "itemId" and "slug"
```

Anything richer goes in a JSON body with `--file` (create) or as a full replacement (update):

```json
{
  "name": "Stripe",
  "upstream": "https://api.stripe.com/v1",
  "methods": ["GET", "POST"],
  "headers": [{ "key": "Authorization", "value": "Bearer {{$VAR.STRIPE_SECRET_KEY}}" }],
  "routes": [
    { "method": "GET",  "path": "charges/{id}", "upstreamPath": "charges/{id}" },
    { "method": "POST", "path": "charges" }
  ],
  "access": { "kind": "BlocksToken", "roles": { "mode": "any", "values": ["billing"] } },
  "resilience": { "timeoutSeconds": 10, "retry": { "attempts": 2, "backoff": "Fixed", "initialDelaySeconds": 1, "idempotent": true }, "breaker": { "failureThreshold": 5, "openSeconds": 60 } },
  "requestsPerMinute": 300
}
```

- **`upstream`** — absolute `https://` URL; no credentials in it (refused). `routes[].upstreamPath` rewrites the path; `{name}` segments must be declared in `path`.
- **`routes`** — the only paths the proxy forwards. Omitted ⇒ only the base path, any suffix is refused. Each route may override `headers`, `query`, `bodyMerge`, `responseMode`/`responseInclude` and `resilience`.
- **`headers` / `query` / `bodyMerge`** — `{ key, value }` pairs added to every forward. Put credentials in as **`{{$VAR.<secretName>}}`**, a reference to a Blocks secret (create it with blocks-secrets first); it is resolved on each call, never stored or echoed, and masked in logs.
- **`responseMode: "Select"`** with **`responseInclude: ["id", "amount"]`** returns only those response fields.
- **`access`** — `kind: "BlocksToken"` (default: any signed-in project user; narrow with `roles`/`permissions` `{ mode: "any"|"all", values }` and `combine: "Or"|"And"`) or `kind: "Public"` (only the project's `x-blocks-key`; no role/permission lists allowed).
- **`resilience`** — `timeoutSeconds` 1–30; `retry.attempts` 1–3 (more than 1 requires `"idempotent": true`), `backoff` `None|Fixed|Exponential`; `breaker` opens after `failureThreshold` failures for `openSeconds`.
- **`requestsPerMinute`** — 1–100000 across all callers; default 600 for Public, unlimited for token proxies.

**Import routes from OpenAPI** instead of typing them:

```bash
blocks logic proxy openapi-preview --spec-file openapi.json --json          # or --spec-url https://…/openapi.json
blocks logic proxy openapi-preview --spec-file openapi.json --proxy-id <id> --json   # flags routes the proxy already has
```

It writes nothing — copy the `operations` you want into `routes` (`method`, `path`) of a create/update `--file`; `securityHeaders` names the auth headers the API expects, to fill with `{{$VAR.…}}` values.

## Change

- **`blocks logic proxy update <id> --name … | --upstream … | --methods … | --requests-per-minute <n|default> | --timeout-seconds <n>`** — read-merge-write: every other field (routes, headers, access, retry/breaker) is kept.
- **`blocks logic proxy update <id> --file proxy.json`** — **full replacement**: omitted `access`, `resilience`, `requestsPerMinute`, `routes`… reset to defaults. Start from `blocks logic proxy get <id> --json` and edit.
- Every update is checked against the version it was read from; `PROXY_VERSION_CONFLICT` means someone changed it in between — re-read and apply again.
- **`enable` / `disable <id>`** — a disabled proxy answers 404 to callers. **`delete <id>`** — removes it; history and logs stay.
- **`versions <id>`** / **`revert <id> <versionId>`** — every change is a version; revert appends a new one.

All writes take `--dry-run` first, then `--yes` after approval.

## Test and observe

- **`blocks logic proxy test <id> --method GET --path-suffix charges/ch_1 [--query 'limit=1'] [--body '<json>']`** — calls the upstream through the saved config without logging an execution. `--draft-file proxy.json` tests an unsaved config (including its resilience settings).
- **`blocks logic proxy executions <id> [--status-class 4xx|5xx]`** → **`execution <id> <executionId>`** — the last 24 h of real calls, secrets redacted.
- **`blocks logic proxy overview <id>`** — calls, latency, error rate.

## SDK — calling a proxy

```ts
import { BlocksApiError } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";

const charge = await blocksClient.logic.proxy.request<{ id: string; amount: number }>("stripe", {
  method: "GET",
  path: "charges/ch_123",
  query: { expand: ["customer"] }
});
```

- **`request(slug, options)`** — parsed response body; any non-2xx throws `BlocksApiError` (`error.status`, `error.body`). The first argument is the proxy's **slug** (from `create`/`get`), not its id.
- **`requestRaw(slug, options)`** — the unread `Response`, for files/streams or when `Retry-After` matters.
- **`url(slug, path?)`** — absolute gateway URL for other backends.
- Options: `method` (default GET), `path`, `query`, `body` (JSON unless already a `BodyInit`), `headers`, `auth` (default true; `false` for a Public proxy called without a session), `signal`.

Gateway refusals carry `PROXY_GATEWAY_<OUTCOME>` codes in `error.body.code`: 401 no/invalid token, 403 access rules or a path no route declares, 404 unknown or disabled proxy, 405 method not allowed, 413 body over 1 MB, 429 rate limit (`Retry-After`), 502/503/504 upstream error/unavailable/timeout. Upstream responses over 5 MB are refused.

## Gotchas

- **Slug for calls, id for configuration.** SDK calls take the slug; every CLI command takes the `itemId`.
- **A path suffix must match a declared route.** A proxy without `routes` forwards only its base path.
- **Never type a key into a header value.** Use `{{$VAR.<secretName>}}`; the literal would be stored and shown to anyone who can read the proxy.
- **`update --file` replaces everything**; use the flag form for small changes.
- **Retries need `"idempotent": true`** — the platform will not replay a request it cannot assume is safe to repeat.
- A workflow can call a proxy with its `proxy` step (see blocks-workflow); app code uses the SDK.

## Example trigger prompts

- "Call the weather API from the frontend without exposing our key." → blocks-secrets for the key, `proxy create --file` with `headers: [{ key: "X-Api-Key", value: "{{$VAR.WEATHER_KEY}}" }]` and the routes, then `blocksClient.logic.proxy.request("weather", …)`.
- "Import the routes from their OpenAPI spec." → `blocks logic proxy openapi-preview --spec-url <url> --json`, then `create`/`update --file`.
- "Only billing admins may use the Stripe proxy." → `get <id> --json`, set `access.roles`, `update <id> --file`.
- "The upstream is flaky." → `update <id> --timeout-seconds 10`, plus `retry`/`breaker` through `--file`.
- "Why are calls failing?" → `blocks logic proxy executions <id> --status-class 5xx --json`, then `execution <id> <executionId>`.
