export type BlocksAuthResponse<T = Record<string, unknown>> = T & {
  access_token?: string;
  accessToken?: string;
  data?: Record<string, unknown>;
  error?: string;
  error_description?: string;
  expires_in?: number;
  expiresIn?: number;
  id_token?: string;
  idToken?: string;
  refresh_token?: string;
  refreshToken?: string;
  scope?: string;
  token_type?: string;
  tokenType?: string;
};

export type BlocksIdpInitiateRequest = {
  clientId?: string;
  forwardedTo?: string;
  redirectUri?: string;
};

export type BlocksIdpInitiateResponse = {
  redirect_uri?: string;
  redirectUri?: string;
};

export type BlocksIdpCallbackRequest = {
  code?: string;
  error?: string;
  error_description?: string;
  state?: string;
};

export type BlocksLoginOption = Record<string, unknown>;

export type BlocksOidcUserInfo = Record<string, unknown> & {
  email?: string;
  name?: string;
  picture?: string;
  sub?: string;
};

export type BlocksAuthLoginRequest = Record<string, unknown> & {
  captchaCode?: string;
  language?: string;
  password?: string;
  rememberMe?: boolean;
  username?: string;
};

export type BlocksSocialLoginRequest = Record<string, unknown> & {
  code?: string;
  redirectUri?: string;
  state?: string;
};

export type BlocksRefreshRequest = Record<string, unknown> & {
  refreshToken?: string;
};

export type BlocksLogoutRequest = Record<string, unknown> & {
  refreshToken?: string;
};

export type BlocksSwitchOrganizationRequest = Record<string, unknown> & {
  organizationId?: string;
  refreshToken?: string;
};

export type BlocksOidcRefreshRequest = {
  clientId?: string;
  refreshToken?: string;
  scope?: string;
};

export type BlocksClientCredentialsRequest = {
  clientId: string;
  clientSecret: string;
  scope?: string;
};

export type BlocksAuthPassThroughResponse = Record<string, unknown>;

export type BlocksAuthJsonOptions = {
  auth?: boolean;
  body?: unknown;
  method?: string;
  query?: Record<string, string | undefined>;
};
