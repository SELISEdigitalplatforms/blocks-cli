export type BlocksHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type BlocksQueryValue = boolean | number | string | ReadonlyArray<boolean | number | string>;

/** One call to a function's public route. */
export type BlocksFunctionInvokeOptions = {
  /**
   * Request body. A plain value is sent as JSON; a `Blob`, `FormData`, `URLSearchParams`,
   * `ArrayBuffer` or stream is sent as is. The handler sees it as `input.body`.
   */
  body?: unknown;
  /**
   * Extra request headers. The handler only sees an allow-list (content type, request ids,
   * known webhook-signature headers) -- send app data in the body or query, not custom headers.
   */
  headers?: HeadersInit;
  /** Defaults to POST. The trigger refuses verbs it does not list with 405. */
  method?: BlocksHttpMethod;
  /** Sub-path after the function id, passed to the handler as `input.path` (`orders/42`). */
  path?: string;
  query?: Record<string, BlocksQueryValue | undefined>;
  /**
   * Send the signed-in user's token (default true). A Token trigger needs it; pass
   * `false` for a Public function called from a page with no session.
   */
  auth?: boolean;
  /**
   * Ask for the 202 + poll token even when the function is deployed as synchronous
   * (`Prefer: respond-async`).
   */
  respondAsync?: boolean;
  /**
   * For a synchronous function, wait at most this many seconds for the answer
   * (`Prefer: wait=<n>`); the platform caps the wait at ~30 s regardless. A call that
   * outlives the wait is answered 202 + poll token, and the run still finishes.
   */
  waitSeconds?: number;
  signal?: AbortSignal;
};

/** The run was queued and has not finished: collect it with `getResult`/`waitForResult`. */
export type BlocksFunctionAccepted = {
  kind: "accepted";
  status: 202;
  runId: string;
  /** Wire status: QUEUED, CLAIMED, STARTING, RUNNING or OUTPUT_PROCESSING. */
  runStatus: string;
  /**
   * One-time capability for `getResult`. Absent only if the platform could not issue
   * one; a caller with `function::read` can still use `getRun`.
   */
  pollToken?: string;
};

/** The function answered within the request (sync trigger), or the platform answered for it. */
export type BlocksFunctionAnswer<T = unknown> = {
  kind: "answered";
  status: number;
  headers: Headers;
  /** Parsed JSON when it parses, otherwise the text. */
  body: T;
  /** From `x-blocks-run-id` when the platform set it. */
  runId?: string;
};

export type BlocksFunctionInvokeResult<T = unknown> = BlocksFunctionAccepted | BlocksFunctionAnswer<T>;

/** Wire statuses a run ends in. */
export type BlocksFunctionTerminalStatus =
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "CANCELLED"
  | "RESOURCE_EXCEEDED"
  | "OUTPUT_FAILED";

/** What the poll route reports: status, and once finished, the outcome. Never the input. */
export type BlocksFunctionRunResult = {
  runId: string;
  /** Wire status, e.g. RUNNING or SUCCEEDED. */
  status: string;
  /** The handler's return value as JSON text, once the run has finished. */
  result?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type BlocksFunctionWaitOptions = {
  /** Delay between polls. Default 1000 ms. */
  intervalMs?: number;
  /** Give up after this long. Default 60 000 ms; the run itself keeps going. */
  timeoutMs?: number;
  signal?: AbortSignal;
};

export type BlocksFunctionCallOptions = BlocksFunctionInvokeOptions & BlocksFunctionWaitOptions;

/** One call through a proxy's gateway route. */
export type BlocksProxyRequestOptions = {
  /** JSON-serialized unless it is already a `BodyInit`. */
  body?: unknown;
  headers?: HeadersInit;
  /** Defaults to GET. Must be one of the proxy's methods and match a declared route. */
  method?: BlocksHttpMethod;
  /** Route after the slug (`charges/ch_1`), matched against the proxy's declared routes. */
  path?: string;
  query?: Record<string, BlocksQueryValue | undefined>;
  /** Send the signed-in user's token (default true). Pass `false` for a Public proxy. */
  auth?: boolean;
  signal?: AbortSignal;
};
