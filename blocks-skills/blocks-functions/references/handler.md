# The handler contract

A function is an ES module (`"type": "module"`) whose **default export** is the handler. Runtime: Node 24 with `fetch`. Types for all of this: `import("@seliseblocks/client/functions")` — `FunctionHandler`, `FunctionInput`, `FunctionContext`, `FunctionHttpResponse`.

```js
export default async function handler(input, ctx) {
  return { ok: true };            // any JSON-serializable value
}
```

## `input`

From an HTTP call or a test:

| Field | Value |
|---|---|
| `method` | `GET`, `POST`, `PUT`, `PATCH` or `DELETE` — always one the trigger accepts |
| `path` | Whatever followed the function id in the URL (`orders/42`), `""` for the root |
| `query` | `{ key: value }`; a repeated key is an array |
| `headers` | Lower-cased **allow-list only**: content-type/length, accept*, user-agent, origin, referer, request/correlation ids, `x-forwarded-*`, and known webhook signature headers (`stripe-signature`, `x-hub-signature*`, `x-github-*`, `x-shopify-*`, `x-slack-*`, `svix-*`, `webhook-*`). Custom headers and `Authorization` never arrive — pass app data in the body or query. |
| `body` | Parsed JSON, raw text for other content types, `null` for none (always `null` on GET) |
| `rawBody` | Exact request bytes, base64 — verify webhook signatures against this |

From a **workflow step**, `input` is the previous step's output (or the step's expression) instead — a handler serving both should branch on whether `input.method` is set.

## `ctx`

| Member | Use |
|---|---|
| `ctx.env.KEY` | Variables, as strings. A `{{secret.<id>}}` variable arrives as the real value, masked in logs. |
| `ctx.log.info/warn/error/debug(message, data?)` | Log lines kept on the run (`blocks logic function logs <runId>`). `console.*` is captured too. |
| `ctx.context` | `tenantId`, `userId` (null when Public), `roles`, `permissions`, `isAuthenticated`. |
| `await ctx.blocks.getAccessToken()` | The caller's Blocks token, for calling other Blocks APIs as that user (`Authorization: Bearer`, with `ctx.context.tenantId` as `x-blocks-key`). `undefined` for a Public call or a scheduled workflow. |
| `ctx.run` | `id`, `version`, `attempt` (2 on the retry), `invokedBy.type` (`http`/`workflow`/`test`/`replay`). |
| `ctx.waitUntil(promise)` | Finish work after the answer is sent (audit writes, notifications) instead of leaving a promise un-awaited. |

`ctx` and `input` exist only inside the handler call. Module top level runs once per sandbox — the place for clients, caches and constants.

## Controlling the HTTP answer (sync trigger)

With `--response-mode sync`, return `{ statusCode, headers?, body? }` to set the response:

```js
return { statusCode: 404, body: { error: "order not found" } };
return { statusCode: 302, headers: { location: "/thanks" } };
```

- `statusCode` 200–599. 204/205/304 carry no body.
- `headers`: content/caching headers (`content-type`, `cache-control`, `etag`, `retry-after`, …), `location` on a 3xx, and `x-*` (not `x-blocks-*`/`x-forwarded-*`). `set-cookie` is always dropped.
- `body`: a string is sent as is, anything else as JSON. Any other return value is 200 + JSON.
- A thrown error answers 502, a timeout 504 (`{ error, runId }`). A call still running after ~30 s gets 202 + poll token; the run finishes anyway.

With the default **async** mode the caller gets 202 and the return value becomes the run's `result`; the SDK's `call()` unwraps the same `{ statusCode, body }` shape so both modes read alike.

## Streaming

An `async function*` handler streams: every `yield` reaches the caller as it happens (SSE with `Accept: text/event-stream`, otherwise chunked text). Read it with the SDK's `invokeRaw()`.

```js
export default async function* handler(input, ctx) {
  for (const word of ["one", "two", "three"]) yield word;
}
```

## Warm sandboxes

HTTP calls of a deployed function reuse a warm sandbox — module-level state survives between calls, which may be different users'. Keep connections (database clients, HTTP agents) at module level; never keep `input`, `ctx`, tokens or per-user data there. Work still running after the answer (an un-awaited promise) makes the platform replace the sandbox — use `ctx.waitUntil`.

## Retries and idempotency

A run that fails for a retryable reason is run once more, 5 seconds later (`ctx.run.attempt === 2`). A handler with side effects (charging, emailing) should be idempotent — key the effect on something in the input.
