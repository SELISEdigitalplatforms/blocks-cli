---
name: blocks-functions
description: "Serverless Node functions on Blocks Logic: write the handler (index.js + package.json), save/test/deploy with `blocks logic function *`, then call it from app code with the SDK's `blocksClient.logic.functions.call()/invoke()` or from a workflow `function` step. Covers triggers (HTTP methods, Public vs Token, sync vs async), variables and `{{secret.<id>}}` references, runs/logs/replay, and the fixed 30 s / 128 MB limits. Use for custom backend code an app or webhook calls, not for event graphs (blocks-workflow) or third-party API passthrough (blocks-proxy)."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Functions

A **function** is a Node 24 ES module the platform runs in a sandbox on demand. The tenant writes the handler; Blocks builds an image, runs it per call, and records every run with its logs. Two surfaces:

- **CLI — `blocks logic function *`** — authoring and operating: create, save source and settings, test, deploy, inspect runs and logs, replay, cancel, delete. **No SDK equivalent.**
- **SDK — `blocksClient.logic.functions.*`** — calling a *deployed* function from app code: `call()`, `invoke()`, `invokeRaw()` (streaming), `waitForResult()`, `url()`.

For CLI work, use blocks-bootstrap first when account or project context is unknown.

**Local snapshot:** `blocks/logic/functions.json` lists the project's functions (summaries — no source), written by `blocks pull --only logic`. Read it before listing; check `_meta.tenantId` / `_meta.pulledAt`. The code itself comes from `blocks logic function export`.

## Lifecycle — save is not deploy

```
create ──► save (working copy) ──► test (runs saved code, no deploy) ──► deploy (new live version)
                 ▲                                                            │
                 └──────────── edit again: status shows isDirty ◄─────────────┘
```

- **Saving never changes what callers get.** The public URL and workflow steps run the *deployed* version until `deploy` succeeds. `isDirty: true` means saved code differs from the live version.
- **Trigger settings are snapshotted at deploy.** Changing `--auth`, `--http-methods` or `--response-mode` takes effect on the next deploy, not on save.
- A new function is a Draft: its URL answers 404 until the first deploy.

The full author → test → deploy loop with a local directory is in [flows/author-test-deploy.md](flows/author-test-deploy.md). The handler contract (`input`, `ctx`, HTTP answers, streaming, warm sandboxes) is in [references/handler.md](references/handler.md).

## CLI — authoring and operating

| Command | Use |
|---|---|
| `blocks logic function list [--search <s>] [--status draft\|live\|paused] [--sort name\|updated]` | Find functions; `isDirty`, `activeVersionNumber`, `runs24h`. |
| `blocks logic function create --name <n> [--template minimal\|httpecho\|fetchtransform\|reusedconnection]` | New Draft seeded from a starter. Prints the `id` every other command takes. |
| `blocks logic function export <id> --dir <path> [--force]` | Write `index.js`, `package.json`, `package-lock.json` (if any) and `function.json` locally. |
| `blocks logic function save <id> --dir <path>` | Upload the directory as the working copy (read-merge-write — anything not supplied keeps its stored value). |
| `blocks logic function save <id> --http-methods GET,POST --auth token --response-mode sync --var KEY=VALUE` | Change settings without touching source. |
| `blocks logic function test <id> [--input '<json>']` | Run the **saved** code once. Real side effects; recorded as a Test run. |
| `blocks logic function deploy <id> [--note <text>]` | Ship the saved code as a new version; waits for the image build. |
| `blocks logic function url <id> [--path <sub>]` | Public URL, `xBlocksKey`, methods, auth mode, response mode, deployed or not. |
| `blocks logic function runs [<id>] [--status failed] [--invoked-by http]` → `run <runId>` → `logs <runId>` | Debug: what ran, with which input, what it returned, what it logged. |
| `blocks logic function replay <runId>` / `cancel <runId>` | Re-run a past input on the live version / stop a queued or running run. |
| `blocks logic function versions <id>` / `source <id> <versionId>` / `build <buildId>` | Deployed history, a version's code, one image build's log. |
| `blocks logic function audit <id>` / `limits` / `delete <id> [--force]` | Who changed what; the fixed profile; delete (refused while workflows use it unless `--force`). |

Every write (`create`, `update`, `save`, `deploy`, `replay`, `cancel`, `delete`) takes `--dry-run` first, then `--yes` after approval. `test` runs code but changes no configuration.

### Settings `save` understands

- **`--http-methods GET,POST,PUT,PATCH,DELETE`** — verbs the URL answers; others get 405. `--http-enabled=false` turns the URL off (workflow steps still work); `--workflow-enabled=false` hides it from workflow steps.
- **`--auth token`** (default) — callers need a Blocks bearer token for this project; narrow with `--roles a,b` / `--permissions a,b`. **`--auth public`** — anyone with the URL and the project's `x-blocks-key`. Where the platform enforces rate limits, a Public function gets 600 calls/min by default; set your own with `--requests-per-minute <n>` (1–100000, or `default`).
- **`--response-mode async`** (default) — callers get 202 + `runId` + `pollToken` and collect the result. **`sync`** — the request is held (up to ~30 s) and the handler's return value *is* the HTTP response.
- **`--var KEY=VALUE`** (repeatable) / **`--unset-var A,B`** — non-secret variables, read as `ctx.env.KEY`. A credential-looking name (`API_KEY`, `TOKEN`, `PASSWORD`, `Authorization`…) **must** hold a secret reference, `--var API_KEY={{secret.<secretId>}}`; a typed value is refused (`FUNCTION_FORBIDDEN_CONTENT`). Create the secret with blocks-secrets first and use its **id**. The function receives the real value, masked in logs.
- **`--allow-install-scripts`** — let npm lifecycle scripts run at build (native packages like `bcrypt`, `sharp`).
- `function.json` (from `export`) carries the same settings as JSON — `trigger`, `variables`, `outputActions`, `limits.requestsPerMinute` — and `save --dir` applies it.

### Fixed limits — not configurable

`blocks logic function limits` reports them: **100 millicores, 128 MB, 30 s per run, 10 concurrent runs per function** (more queue, none refused), **2 attempts** (one retry after 5 s), 1 MB input, 5 MB result. A job longer than 30 s is not a function — fan it out into several calls or use blocks-workflow.

## SDK — calling a deployed function

```ts
import { BlocksApiError, BlocksFunctionRunError } from "@seliseblocks/client";
import { blocksClient } from "../../lib/blocks/client";

// The value, whether the function is deployed sync or async:
const quote = await blocksClient.logic.functions.call<{ total: number }>("<functionId>", {
  method: "POST",
  path: "quotes",            // handler sees input.path === "quotes"
  body: { items: [{ sku: "A1", qty: 2 }] }
});
```

- **`call(id, options)`** — invokes; a sync answer's body is returned, an async run is polled until it finishes and its result parsed. A returned `{ statusCode, headers, body }` is unwrapped to `body`. Throws `BlocksApiError` for platform refusals and 4xx/5xx answers, `BlocksFunctionRunError` (`status`, `errorCode`, `errorMessage`) for a run that failed or timed out.
- **`invoke(id, options)`** — the transport-level result: `{ kind: "answered", status, headers, body, runId? }` or `{ kind: "accepted", runId, runStatus, pollToken }`. Then **`waitForResult(accepted, { intervalMs, timeoutMs })`** or **`getResult(runId, pollToken)`** to collect it.
- **`invokeRaw(id, options)`** — the unread `Response`, for a streaming handler (`async function*`); send `headers: { Accept: "text/event-stream" }` for SSE.
- **`url(id, path?)`** — the absolute public URL to hand to a webhook provider or another backend.
- Options: `method` (default POST), `path`, `query` (arrays repeat the key), `body`, `headers`, `auth` (default true — set `false` for a Public function called without a session), `respondAsync`, `waitSeconds`, `signal`.

The SDK sends the signed-in user's token; for a **Token** function that user needs whatever `--roles`/`--permissions` the trigger demands, or the call is 403 `FUNCTION_INVOKE_FORBIDDEN`. Inside the function, `await ctx.blocks.getAccessToken()` returns that same caller's token for calling other Blocks APIs.

**Callers outside the app** (a payment provider's webhook, a cron elsewhere): give them the URL from `blocks logic function url <id>`, the project's tenant id as the `x-blocks-key` header, and — unless the trigger is Public — a Blocks bearer token. A webhook provider that cannot send a token needs `--auth public`; verify its signature inside the handler from `input.rawBody` and `input.headers`.

## Workflow steps

A workflow `function` action step runs a deployed function synchronously and passes its return value to the next step — see blocks-workflow for the node shape. The trigger must keep `workflowEnabled` on. Deleting a function that workflow steps point at is refused (`FUNCTION_DELETE_BLOCKED`) unless `--force`, after which those steps fail.

## Error codes

| Code | Meaning / next step |
|---|---|
| `FUNCTION_NOT_FOUND` | Wrong id or another project — `blocks logic function list`. |
| `FUNCTION_VALIDATION` | Bad save: `package.json` must declare `"type": "module"`, names 2–64 chars, variable keys must be identifiers. |
| `FUNCTION_FORBIDDEN_CONTENT` | A credential-looking variable/header holds a typed value (use `{{secret.<id>}}`), or test input carries a credential-looking key. |
| `FUNCTION_BUILD_FAILED` | `npm install` or image build failed — `blocks logic function build <buildId>` shows the log. |
| `FUNCTION_BUILD_PENDING` | `deploy` timed out waiting; nothing deployed — rerun with `--build-id`. |
| `FUNCTION_DELETE_BLOCKED` | Active runs or workflow steps use it — `--force` only after confirming. |
| `FUNCTION_RATE_LIMITED` / `FUNCTION_UNAVAILABLE` | Wait and retry; nothing ran. |
| SDK `FUNCTION_INVOKE_NOT_FOUND` | Not deployed, or the id is wrong. |
| SDK `FUNCTION_INVOKE_METHOD_NOT_ALLOWED` | Verb not in `--http-methods` (the `Allow` header lists the accepted ones). |

## Gotchas

- **Deploy after every change you want live**, including settings. `test` exercises the *saved* code; the URL serves the *deployed* version.
- **`ctx` exists only inside the handler.** Touching it at module top level fails the run before the handler is called.
- **Warm sandboxes are reused across calls — possibly different users'.** Keep clients and caches at module level, never request data or tokens.
- **Never put a credential in source or a plain variable.** Use a `{{secret.<id>}}` variable; the platform refuses typed credentials.
- **No SDK path for management.** Creating, saving and deploying from app code is not supported — that is `blocks logic function *` in a terminal.
- **Pick the right tool:** a single upstream API call with a hidden key → blocks-proxy; event/schedule-driven multi-step logic → blocks-workflow; custom code → this skill.

## Example trigger prompts

- "Write a function that computes shipping quotes and call it from the checkout page." → [flows/author-test-deploy.md](flows/author-test-deploy.md), then SDK `blocksClient.logic.functions.call(...)`.
- "Why did my function fail last night?" → `blocks logic function runs <id> --status failed --json`, then `run <runId>` and `logs <runId>`.
- "Let Stripe call our function as a webhook." → `save <id> --auth public --http-methods POST`, deploy, `blocks logic function url <id>`; verify the signature from `input.rawBody`.
- "Use our OpenAI key in the function." → blocks-secrets to create it, then `save <id> --var OPENAI_API_KEY={{secret.<secretId>}}`, deploy.
- "Roll back the function." → `versions <id>`, `source <id> <versionId>`, write those files to a directory, `save --dir`, `deploy`.
