# Changelog

All notable changes to `@seliseblocks/client`.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Versions before 0.2.0 were released without a changelog; their history is in the
repository's git log.

## 0.3.0

### Added

- `blocks.logic` -- the blocks-logic runtime surface:
  - `logic.functions.call(id, options)` invokes a deployed function and returns
    its value whether it is deployed sync (the answer's body) or async (polls the
    run, parses its result). A returned `{ statusCode, headers, body }` is
    unwrapped to `body` so both modes read alike. A run that fails or times out
    throws the new `BlocksFunctionRunError`.
  - `logic.functions.invoke()` returns the transport result --
    `{ kind: "answered", status, headers, body, runId? }` or
    `{ kind: "accepted", runId, runStatus, pollToken }` -- with `respondAsync` /
    `waitSeconds` mapped to the `Prefer` header; `waitForResult()`,
    `getResult(runId, pollToken)` and `getRun(runId)` collect a queued run;
    `invokeRaw()` returns the unread `Response` for streaming handlers;
    `url()` gives the public address.
  - `logic.proxy.request(slug, options)` / `requestRaw()` / `url()` call a
    configured proxy's gateway route.
- `@seliseblocks/client/functions` -- type-only declarations of the function
  sandbox contract (`FunctionHandler`, `FunctionInput`, `FunctionContext`,
  `FunctionHttpResponse`, …) for editor checking of a function's `index.js`.
  Nothing from it is needed at runtime inside a function.
- `http.send(path, options)` -- the same authenticated request as
  `http.request`, returning the unread `Response` (status and headers intact,
  never throws on a non-2xx). `request` is now built on it, unchanged.
- Request `query` values may be arrays (a repeated key), and requests take an
  `AbortSignal` (`signal`).

### Fixed

- `auth.switchOrganization({ organizationId })` now sends IAM's
  `organization_id`.
  - Why: IAM binds `SwitchOrganizationRequest.OrganizationId` only as
    `organization_id` (`[JsonPropertyName]`). The SDK sent the camelCase name,
    so every call that followed the documented type failed with 400
    `organization_id is required`.
  - Compatible: the type is unchanged. A caller already sending
    `organization_id` keeps working, and that value still wins when both are
    given, matching what IAM bound before. Other extra fields pass through as
    before.
  - `refreshToken` on this request is deprecated and no longer sent. IAM's
    switch-org reads the refresh token only from the session cookie (or its
    `rt_<domain>` header), never from the body. It had no effect, and sending
    it only put a secret in a request body. Switch organization from a browser
    session that holds the IAM cookie.
- `BlocksApiError.message` now includes the reason from validation responses.
  - Why: the message was built only from `message`, `detail`,
    `error_description` and `error`. ASP.NET validation responses
    (`{ title, errors }`) and Blocks mutation responses (`{ errors: { Field:
    "text" } }`) carry the reason in `errors`, so the message was only the
    status line (`Blocks API 400 Bad Request`) and the reason sat unseen in
    `.body`.
  - What: when none of those four fields is present, the message adds the
    `errors` entries (`Field: text`, first five fields), or else `title`.
  - Compatible: `status`, `statusText` and `body` are unchanged, and a body
    that already had `message` / `detail` / `error_description` / `error`
    gives exactly the same message as before.

### Fixed (blocks-site reports)

- `notifier.notify` fills `connectionId`, `responseKey` and `responseValue` with
  `server` / `notification` / `notification` when omitted. The service binds all
  three as required strings, so the documented minimal call failed with 400
  (95737817). `organizationIds` is added to the request type.
- `iam.users.emailAvailable` and `iam.users.exists` use IAM's POST forms; the
  deprecated GETs put the address in the URL (3b86fd8d).

### Breaking (type-level)

- `iam.users.activate` takes `BlocksActivateUserRequest` (`{ userId, reason }`,
  both required) instead of `Record<string, unknown>`. IAM requires `reason`, so a
  call without it always failed with 400; the type now says so (bacbaebd).
- `BlocksNotifyRequest.configurationName` and `.denormalizedPayload` are required.
  Every send without them was already refused by the service (95737817).

### Changed

- `iam.organizations.list` accepts an array for `Filter.Ids`; its JSDoc documents
  that IAM pages from 0 and refuses `Filter.*` without a non-empty `Filter.Search`.

## 0.2.0

### Breaking

- `blocks.config` no longer carries `accessToken` or `onUnauthorized`. Both are
  callables that reach a live session, and this package's stated boundary is that
  it never becomes somewhere to read one from. Use
  `await blocks.auth.accessToken()` for the token; the hook stays available to
  the client internally. Everything else on `config` (`apiUrl`, `xBlocksKey`,
  `appDomain`, `oidc`) is unchanged, and its type is now `BlocksPublicConfig`.
- `http.request()` refuses an absolute URL whose origin is not the configured
  `apiUrl`. It attaches the bearer token, `x-blocks-key`, and cookies, so a
  foreign origin would have received a live session. `http.external(url)` is the
  path for third-party URLs and sends no Blocks credentials. An absolute URL on
  the configured API still works.

### Added

- Types that were reachable in the public surface but not importable by name are
  now exported: `BlocksHttpClient`, `BlocksDataSchema`,
  `BlocksDataCollectionOptions`, `BlocksDataGetOptions`,
  `BlocksDataDeleteOptions`, `BlocksAuthJsonOptions`,
  `BlocksExternalRequestOptions`, and `BlocksPublicConfig`.

### Changed

- `RequiredConfig` is renamed `BlocksResolvedConfig`, matching every other
  exported name. `RequiredConfig` remains as a deprecated alias.
- Documented the IAM enums the typings previously called opaque:
  `mfaType`/`UserMfaType` (0 None, 1 TOTP, 2 Email, 3 Sms, 4 WhatsApp — only 1
  and 2 have a provider, and `setMethod` turns MFA *off* for any other value)
  and the notifier sort order (1 CreatedTime newest-first, 2 ReadStatus; any
  other value, including an omitted 0, returns an empty list).

### Fixed

- A non-2xx response whose body is not valid JSON despite an
  `application/json` content type now throws `BlocksApiError` carrying the status
  and the raw text. It previously threw a bare `SyntaxError` before the status
  was ever checked, which lost the status and broke the documented contract that
  every non-2xx response surfaces as a `BlocksApiError` — the case that matters
  most, since a proxy or WAF error page is exactly what arrives mislabelled.
- The README's MFA examples were stranded under the Auth heading with no heading
  of their own.

### Package metadata

- Added `repository`, `homepage`, `bugs`, and `author`.
- `LICENSE` now matches the repository's copyright line.
