import { BlocksApiError } from "../http/errors.js";
import { BlocksHttpClient, parseBody } from "../http/http-client.js";
import {
  BlocksFunctionAccepted,
  BlocksFunctionCallOptions,
  BlocksFunctionInvokeOptions,
  BlocksFunctionInvokeResult,
  BlocksFunctionRunResult,
  BlocksFunctionTerminalStatus,
  BlocksFunctionWaitOptions
} from "./types.js";
import { trimSlashes } from "./route.js";

/** The public function route under the API gateway; the management API is CLI-only. */
const FUNCTION_API = "/logic/v4/fn";

const TERMINAL: ReadonlySet<string> = new Set<BlocksFunctionTerminalStatus>([
  "SUCCEEDED", "FAILED", "TIMED_OUT", "CANCELLED", "RESOURCE_EXCEEDED", "OUTPUT_FAILED"
]);

/** A run that finished without an answer: FAILED, TIMED_OUT, CANCELLED or RESOURCE_EXCEEDED. */
export class BlocksFunctionRunError extends Error {
  constructor(
    public readonly runId: string,
    public readonly status: string,
    public readonly errorCode?: string | null,
    public readonly errorMessage?: string | null
  ) {
    super(`Function run ${runId} ended ${status}${errorCode ? ` (${errorCode})` : ""}${errorMessage ? `: ${errorMessage}` : ""}`);
    this.name = "BlocksFunctionRunError";
  }
}

/**
 * Calling deployed Blocks functions from app code. Creating, saving, deploying and
 * inspecting functions is CLI work (`blocks logic function *`), not exposed here.
 */
export class BlocksFunctionsClient {
  constructor(
    private readonly http: BlocksHttpClient,
    private readonly apiUrl: string
  ) {}

  /**
   * What: the absolute public URL of a function (optionally with a sub-path).
   * Why: third parties (webhooks, other backends) call the function directly and need its address.
   * How: callers send this project's `x-blocks-key`, plus a Blocks bearer token unless the trigger is Public.
   */
  url(functionId: string, path?: string): string {
    return `${this.apiUrl}${routeOf(functionId, path)}`;
  }

  /**
   * What: invokes a deployed function and returns either its answer or the queued run.
   * Why: functions run async (202 + poll token) unless deployed as sync, and callers need to know which happened.
   * How: `kind: "answered"` carries the function's own status/headers/body; `kind: "accepted"` carries
   * `runId` + `pollToken` for `waitForResult`. Any non-2xx is thrown as `BlocksApiError` -- the platform's
   * refusals (`FUNCTION_INVOKE_*` codes: 401/403/404/405/413/429/503), a failed or timed-out sync run
   * (502/504 with `runId`), and a status the function chose itself. Use `call` for just the value.
   */
  async invoke<T = unknown>(functionId: string, options: BlocksFunctionInvokeOptions = {}): Promise<BlocksFunctionInvokeResult<T>> {
    const response = await this.invokeRaw(functionId, options);
    const body = await parseBody(response);
    if (!response.ok) throw new BlocksApiError(response.status, response.statusText, body);

    if (response.status === 202 && isRecord(body) && typeof body.runId === "string") {
      const accepted: BlocksFunctionAccepted = {
        kind: "accepted",
        status: 202,
        runId: body.runId,
        runStatus: String(body.status ?? "QUEUED")
      };
      if (typeof body.pollToken === "string") accepted.pollToken = body.pollToken;
      return accepted;
    }

    const runId = response.headers.get("x-blocks-run-id") ?? undefined;
    return { kind: "answered", status: response.status, headers: response.headers, body: body as T, ...(runId ? { runId } : {}) };
  }

  /**
   * What: invokes a function and returns the unread `Response`.
   * Why: a streaming function (an `async function*` handler) sends its pieces as they come; reading
   * them needs the body stream, which `invoke` buffers.
   * How: same request as `invoke`. Pass `headers: { Accept: "text/event-stream" }` for Server-Sent
   * Events (`data:` per piece, then `event: done` or `event: error`); otherwise the pieces arrive as
   * chunked text. Never throws on a non-2xx status -- check `response.ok`.
   */
  invokeRaw(functionId: string, options: BlocksFunctionInvokeOptions = {}): Promise<Response> {
    const headers = new Headers(options.headers);
    if (!headers.has("Accept")) headers.set("Accept", "application/json");
    const prefer = [
      options.respondAsync ? "respond-async" : undefined,
      options.waitSeconds !== undefined ? `wait=${Math.max(0, Math.floor(options.waitSeconds))}` : undefined
    ].filter(Boolean);
    if (prefer.length > 0) headers.set("Prefer", prefer.join(", "));

    return this.http.send(routeOf(functionId, options.path), {
      auth: options.auth,
      body: options.body,
      headers,
      method: options.method ?? "POST",
      query: options.query,
      signal: options.signal
    });
  }

  /**
   * What: reads a queued run's status and, once it finished, its result.
   * Why: an async invocation answers 202 at once; this is how its outcome is collected.
   * How: pass the `runId` and `pollToken` from the 202. No user session is needed -- the token is
   * the capability -- and any wrong, expired or foreign token is the same 404.
   */
  async getResult(runId: string, pollToken: string, options: { signal?: AbortSignal } = {}): Promise<BlocksFunctionRunResult> {
    const response = await this.http.send(`${FUNCTION_API}/runs/${encodeURIComponent(runId)}/result`, {
      auth: false,
      headers: { Accept: "application/json", "x-poll-token": pollToken },
      signal: options.signal
    });
    const body = await parseBody(response);
    if (!response.ok) throw new BlocksApiError(response.status, response.statusText, body);
    return body as BlocksFunctionRunResult;
  }

  /**
   * What: the full run record (input, result, attempts, timings) for a signed-in caller.
   * Why: an admin screen or a caller without a poll token may need the whole run.
   * How: requires the `blocks-logic::function::read` permission; reads within the caller's own tenant.
   */
  getRun<T = Record<string, unknown>>(runId: string): Promise<T> {
    return this.http.request<T>(`${FUNCTION_API}/runs/${encodeURIComponent(runId)}`);
  }

  /**
   * What: polls a queued run until it finishes.
   * Why: turns the 202 + poll token into the final outcome without hand-written polling.
   * How: resolves with the terminal `BlocksFunctionRunResult` (check `status`); rejects on `timeoutMs`
   * (the run itself keeps going) or `signal` abort.
   */
  async waitForResult(
    accepted: Pick<BlocksFunctionAccepted, "runId" | "pollToken">,
    options: BlocksFunctionWaitOptions = {}
  ): Promise<BlocksFunctionRunResult> {
    if (!accepted.pollToken) {
      throw new Error(`Run ${accepted.runId} has no poll token; read it with getRun() (needs function::read) instead.`);
    }
    const interval = options.intervalMs ?? 1000;
    const deadline = Date.now() + (options.timeoutMs ?? 60_000);
    for (;;) {
      const result = await this.getResult(accepted.runId, accepted.pollToken, { signal: options.signal });
      if (TERMINAL.has(result.status)) return result;
      if (Date.now() + interval > deadline) {
        throw new Error(`Run ${accepted.runId} is still ${result.status}; stopped waiting (the run continues).`);
      }
      await delay(interval, options.signal);
    }
  }

  /**
   * What: invokes a function and returns its value, however it was deployed.
   * Why: most callers want the handler's return value, not the transport details.
   * How: a sync answer's body is returned as is; an async run is awaited and its result parsed. A
   * returned `{ statusCode, headers, body }` is unwrapped to `body` (a 4xx/5xx `statusCode` throws
   * `BlocksApiError`). A run that fails throws `BlocksFunctionRunError`.
   */
  async call<T = unknown>(functionId: string, options: BlocksFunctionCallOptions = {}): Promise<T> {
    const outcome = await this.invoke<T>(functionId, options);
    if (outcome.kind === "answered") return outcome.body;

    const run = await this.waitForResult(outcome, options);
    if (run.status !== "SUCCEEDED" && run.status !== "OUTPUT_FAILED") {
      throw new BlocksFunctionRunError(run.runId, run.status, run.errorCode, run.errorMessage);
    }
    const value = parseResult(run.result);
    if (isHttpResponseShape(value)) {
      if (value.statusCode >= 400) throw new BlocksApiError(value.statusCode, "", value.body);
      return value.body as T;
    }
    return value as T;
  }
}

function routeOf(functionId: string, path?: string): string {
  if (!functionId) throw new Error("A function id is required.");
  const suffix = trimSlashes(path ?? "");
  const root = `${FUNCTION_API}/${encodeURIComponent(functionId)}`;
  return suffix ? `${root}/${suffix}` : root;
}

function parseResult(result: string | null | undefined): unknown {
  if (result === null || result === undefined || result === "") return undefined;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

/** The handler's HTTP-answer shape (`FunctionHttpResponse`): `statusCode` plus only `headers`/`body`. */
function isHttpResponseShape(value: unknown): value is { statusCode: number; headers?: unknown; body?: unknown } {
  if (!isRecord(value) || typeof value.statusCode !== "number") return false;
  return Object.keys(value).every((key) => key === "statusCode" || key === "headers" || key === "body");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("Aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error("Aborted"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
