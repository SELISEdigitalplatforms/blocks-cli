# AI Usage Guide

Use this file only for `@seliseblocks/client` app-code work. For full method details, read the source docstrings.

Source refs:

- Client setup: `src/client.ts`
- Auth: `src/auth/auth-client.ts`
- IAM: `src/iam/iam-client.ts`
- Data: `src/data/data-client.ts`
- Localization: `src/localization/localization-client.ts`
- MFA: `src/mfa/mfa-client.ts`
- HTTP/errors: `src/http/http-client.ts`, `src/http/errors.ts`

## Non-Negotiable Rules

- Configure `xBlocksKey`; SDK sends it as `x-blocks-key`.
- Do not send `ProjectKey` or `projectKey`.
- Do not add `/api` after `/v4`.
- Valid route shapes: `/iam/v4/...`, `/data/v4/...`, `/localization/v4/...`.
- SDK does not store tokens. App owns access token, refresh token, storage, and logout cleanup.
- Frontend code must not contain client secrets.
- Do not add impersonation, release deploy, schema/rules mutation, or localization authoring/admin APIs.

## Create Client

```ts
import { createBlocksClient } from "@seliseblocks/client";

export const blocks = createBlocksClient({
  apiUrl: "https://api.seliseblocks.com",
  xBlocksKey: env.BLOCKS_KEY,
  accessToken: () => session.accessToken,
  oidc: {
    url: "https://iam.seliseblocks.com",
    clientId: env.OIDC_CLIENT_ID,
    redirectUri: env.OIDC_REDIRECT_URI ?? `${window.location.origin}/login/callback`
  }
});
```

Use `accessToken` only for the current token resolver. Do not add SDK token storage.
Use a configured `redirectUri` when available; the current-origin `/login/callback` URL is only a browser fallback.

## Auth Decision

There are two auth flows.

OIDC/hosted IAM flow:

- Login: `blocks.auth.idp.initiate()`, `blocks.auth.idp.redirectToProvider()`, `blocks.auth.idp.callback(...)`
- Refresh: `blocks.auth.oidc.refreshToken({ refreshToken })`
- Refresh route: `POST /iam/v4/oidc/token`
- Must send `client_id`; SDK uses `request.clientId` or configured `oidc.clientId`.
- Do not manually build `oidc/authorize`.

Embedded/app-owned flow:

- Login: `blocks.auth.login(...)`
- Social: `blocks.auth.socialInitiate(clientId, redirectUri)` (two positional strings), `blocks.auth.socialCallback(request)` (object)
- Refresh: `blocks.auth.refresh({ refreshToken })`
- Routes: `/iam/v4/auth/login`, `/iam/v4/auth/social/*`, `/iam/v4/auth/refresh`

Shared auth methods for both flows:

- `userInfo()`
- `switchOrganization(...)`
- `logout(...)`, `logoutAll(...)`
- `signup(...)`, `recover(...)`, `resetPassword(...)`
- `changePassword(...)`
- `activate(...)`, `resendActivation(...)`, `validateActivation(...)`
- `identityProviders.*`, `config.*`, `userCodes.*`, `clientCredentials.*` when app has permission
- `accessToken()` - resolves the caller-owned bearer token configured on `createBlocksClient`.
- `isAuthenticated()` - checks the session against IAM via `GET /iam/v4/auth/me`, returns a boolean from the raw response status. Prefer this over `userInfo()` for a true/false check, since a hosted-IdP session may live in a cookie with no local `accessToken` to inspect.

## Service Map

IAM:

- `blocks.iam.me()`
- `blocks.iam.users.*`
- `blocks.iam.roles.*`
- `blocks.iam.permissions.*`
- `blocks.iam.resources.*`
- `blocks.iam.organizations.*`
- `blocks.iam.signupSettings.get()` / `.save(...)`

MFA:

- `blocks.mfa.config()` / `.saveConfig(...)` - tenant MFA policy
- `blocks.mfa.totp.setup()` / `.verifySetup({ code })` - TOTP enrollment
- `blocks.mfa.generate(...)` / `.resend(...)` / `.verify(...)` - OTP challenge flow
- `blocks.mfa.setMethod({ mfaType })`, `.disable()`
- `blocks.mfa.backupCodes.list()` / `.generate()` / `.use({ code, userId })`

Data:

- `blocks.data.schemas.*` for schema reads only
- `blocks.data.validations.*` for validation reads
- `blocks.data.collection("Name").list/get/create/update/delete`
- `blocks.data.graphql(...)`
- `blocks.data.files.*` for file/storage helpers
- `blocks.data.directories.*` for directory create/get/update/delete/move
- `blocks.data.objects.*` for browse/search/trash/shared/restore/share/access/inheritance
- `blocks.data.utilities.*` for runtime utility helpers

Localization:

- `blocks.localization.languages()`
- `blocks.localization.modules()`
- `blocks.localization.languagesForCurrentTenant()`
- `blocks.localization.modulesForCurrentTenant()`
- `blocks.localization.translations(moduleName, language)`
- `blocks.localization.load(language, modules)`
- `blocks.localization.cloudTranslations(moduleName, language)`
- `blocks.localization.loadCloud(language, modules)`
- `blocks.localization.keysByNames(...)`
- `blocks.localization.t(key, fallback, options)`

HTTP fallback:

- Use `blocks.http.request("/service/v4/...")` only when no typed method exists.
- Use `blocks.http.external(url, ...)` only for external URLs such as pre-signed uploads.

Errors:

- Every non-2xx response from `http.request`/`http.external` throws `BlocksApiError` (`status`, `statusText`, `body`). Catch it with `instanceof BlocksApiError` rather than assuming a generic `Error` shape.

## Minimal Examples

```ts
const me = await blocks.iam.me();
const schemas = await blocks.data.schemas.list({ pageNo: 1, pageSize: 20 });
const rows = await blocks.data.collection("Students").list({ pageNo: 1, pageSize: 20 });
await blocks.localization.load("en-US", ["common"]);
const label = blocks.localization.t("save", "Save");
```

OIDC refresh with explicit client id:

```ts
await blocks.auth.oidc.refreshToken({
  clientId: env.OIDC_CLIENT_ID,
  refreshToken: session.refreshToken
});
```

Embedded refresh:

```ts
await blocks.auth.refresh({
  refreshToken: session.refreshToken
});
```

## Check Before Finishing

```bash
npm test
npm run lint
npm pack --dry-run
rg -n "v4[/\\]api|iam[/\\]v4[/\\]api|data[/\\]v4[/\\]api|localization[/\\]v4[/\\]api" src README.md AI_USAGE_GUIDE.md test
```

Only negative route-guard tests should match.
