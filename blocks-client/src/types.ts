export type BlocksRequestOptions = {
  accessToken?: string;
  auth?: boolean;
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
  /** A repeated key is an array (`?tag=a&tag=b`). */
  query?: Record<string, boolean | number | string | ReadonlyArray<boolean | number | string> | undefined>;
  signal?: AbortSignal;
};

export type BlocksExternalRequestOptions = {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
};
