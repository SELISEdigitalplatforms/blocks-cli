export type BlocksRequestOptions = {
  accessToken?: string;
  auth?: boolean;
  body?: unknown;
  headers?: HeadersInit;
  method?: string;
  query?: Record<string, boolean | number | string | undefined>;
};

export type BlocksExternalRequestOptions = {
  body?: BodyInit | null;
  headers?: HeadersInit;
  method?: string;
};
