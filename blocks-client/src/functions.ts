/**
 * Types for code that runs INSIDE a Blocks function -- the sandbox contract the runner's
 * bootstrap hands every handler. Type-only: a function's own package.json does not need this
 * package at runtime. Use it as a devDependency for editor completion and checking:
 *
 * ```js
 * // index.js (the function's package.json declares "type": "module")
 * /** @type {import("@seliseblocks/client/functions").FunctionHandler} *\/
 * export default async function handler(input, ctx) {
 *   ctx.log.info("called", { path: input.path });
 *   return { ok: true };
 * }
 * ```
 *
 * Runtime: Node 24, ES modules. Every run gets the same fixed profile -- 100 millicores,
 * 128 MB, 30 s wall clock, 10 concurrent runs per function, one retry after 5 s.
 */

/** HTTP verbs a trigger may accept. */
export type FunctionHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * What an HTTP or Test invocation hands the handler. Anything after `/fn/{id}` is `path`; the
 * body arrives parsed when it is JSON. A workflow step passes the previous step's output
 * instead of this shape, so a handler used from both should check `input.method`.
 */
export interface FunctionInput {
  /** One of the trigger's accepted methods -- any other is refused with 405 before the handler runs. */
  readonly method: FunctionHttpMethod;
  /** `orders/42` for a call to `…/fn/{id}/orders/42`; `""` for the root. */
  readonly path: string;
  /** A repeated key is an array. */
  readonly query: Readonly<Record<string, string | string[]>>;
  /** Lower-cased. Content negotiation, provenance and webhook signatures -- never a credential. */
  readonly headers: Readonly<Record<string, string>>;
  /** Parsed JSON, the raw text for other content types, null for no body (always null on GET). */
  readonly body: unknown;
  /**
   * The exact request bytes, base64 -- what a webhook signature is computed over. Null with no
   * body, or when the body is too large to carry twice.
   */
  readonly rawBody: string | null;
}

/** Who invoked this run. An empty identity on a public call -- never a privileged token. */
export interface FunctionCallerContext {
  readonly tenantId: string;
  /** null when the trigger is public. */
  readonly userId: string | null;
  readonly roles: readonly string[];
  readonly permissions: readonly string[];
  readonly isAuthenticated: boolean;
}

/** Calling Blocks APIs as the caller. */
export interface FunctionBlocksAccess {
  /**
   * A fresh, short-lived Blocks access token for the user who invoked this run -- pass it as the
   * `Authorization: Bearer` of a Blocks API call, with `ctx.context.tenantId` as `x-blocks-key`.
   * Fetched on demand (one IAM round trip per run; later calls in the same run get the same
   * token). Resolves to `undefined` when there is no signed-in caller (a public trigger, a
   * scheduled workflow) or none could be issued. Masked in logs.
   */
  getAccessToken(): Promise<string | undefined>;
}

/**
 * The function's variables, as plain strings, snapshotted at deploy. A variable bound to a
 * secret (`{{secret.<id>}}`) arrives as its real value and is masked in logs.
 */
export interface FunctionEnv {
  readonly [key: string]: string | undefined;
}

/** This run's own metadata. */
export interface FunctionRun {
  readonly id: string;
  /** Active version number this run executed on. */
  readonly version: number;
  /** 1 for the first try; 2 when the retry re-ran it. */
  readonly attempt: number;
  readonly invokedBy: {
    readonly type: "http" | "workflow" | "test" | "replay";
    /** What started the run (e.g. the workflow), or null when there is none. */
    readonly id: string | null;
  };
}

/** Structured log lines kept on the run (`blocks logic function logs <runId>`); `console` is captured too. */
export interface FunctionLogger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

/**
 * Everything the sandbox hands a function, fresh for every call.
 *
 * HTTP calls of a deployed function reuse a warm sandbox: module-level code runs once and its
 * variables live on to the next call -- maybe another user's. Keep connections and caches at
 * module level; keep request data (input, ctx, tokens) inside the handler. Await everything, or
 * hand work that may finish after the answer to `waitUntil`.
 */
export interface FunctionContext {
  readonly context: FunctionCallerContext;
  readonly blocks: FunctionBlocksAccess;
  readonly env: FunctionEnv;
  readonly run: FunctionRun;
  readonly log: FunctionLogger;
  /**
   * Finish work after the answer is sent: the caller gets the result at once, the promise runs
   * on (within the time limit) and the sandbox is not reused until it settles. Use it instead of
   * a promise you do not await -- work still running after the answer makes the sandbox be replaced.
   */
  waitUntil(promise: Promise<unknown>): void;
}

/**
 * Return this from the handler to control the HTTP answer when the trigger's response mode is
 * `sync`. Anything else you return is sent as 200 + JSON.
 *
 * - `statusCode` 200-599 (1xx is refused). 204/205/304 never carry a body.
 * - `headers`: only content and caching headers pass (content-type, content-language,
 *   content-disposition, cache-control, expires, last-modified, etag, vary, retry-after),
 *   `location` on a 3xx to an http(s) or relative URL, and `x-*` (except x-forwarded-*,
 *   x-real-ip, x-original-*, x-blocks-*). `set-cookie` is always dropped.
 * - `body`: a string is sent as is; anything else as JSON.
 *
 * A failed run answers 502, a timed-out one 504 (`{ error, runId }`). A call that takes too
 * long gets 202 + a poll token instead -- the run still finishes.
 */
export interface FunctionHttpResponse {
  statusCode: number;
  headers?: Record<string, string | string[]>;
  body?: unknown;
}

/**
 * The module's default export. `input` and `ctx` exist only inside the handler: top-level code
 * runs once when the sandbox starts (the place for clients, caches and constants), and touching
 * `ctx` there fails the run before the handler is called. An `async function*` handler streams
 * each yielded piece to the caller.
 */
export type FunctionHandler<TResult = unknown> = (
  input: FunctionInput,
  ctx: FunctionContext
) => TResult | Promise<TResult> | AsyncIterable<unknown>;
