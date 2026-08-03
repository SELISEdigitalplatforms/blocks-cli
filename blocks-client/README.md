# Blocks Client

Framework-neutral TypeScript SDK for SELISE Blocks frontend and app-runtime code.

`@seliseblocks/client` gives consumer apps a small, typed wrapper around the Blocks APIs they normally call at runtime: Auth/IAM, Data, Localization, and shared HTTP configuration. Detailed `what / why / how` descriptions are kept on the SDK functions themselves so editors and generated typings show the guidance where developers use the API.

Admin/control-plane work belongs in `@seliseblocks/cli-os`: project setup, schema/rules deploy, release deploy, and AI/admin terminal workflows.

For AI agents and automation, see [AI_USAGE_GUIDE.md](AI_USAGE_GUIDE.md).

## Install

```bash
npm install @seliseblocks/client
```

Requires Node.js 20+ or a browser/runtime with `fetch`.

## Create A Client

```ts
import { createBlocksClient } from "@seliseblocks/client";

const blocks = createBlocksClient({
  apiUrl: "https://api.seliseblocks.com",
  xBlocksKey: "<blocks-key>",
  accessToken: () => currentUserSession?.accessToken,
  oidc: {
    url: "https://iam.seliseblocks.com",
    clientId: "<public-browser-client-id>",
    redirectUri: configuredRedirectUri ?? `${window.location.origin}/login/callback`
  }
});
```

`xBlocksKey` is always sent as the `x-blocks-key` header. Do not send `ProjectKey` or `projectKey` in request query/body payloads.

The SDK does not store tokens. Your app owns login state, refresh scheduling, storage, and logout cleanup.

Use a configured OIDC redirect URI when your app has one. The current-origin `/login/callback` URL is only a browser fallback.

## Auth

Auth has two login flows.

OIDC/hosted IAM login uses `auth.idp`. The SDK relies on Blocks IAM `IdpController`, sends the configured public `clientId`, and does not manually build `oidc/authorize` URLs. Refresh OIDC sessions with `auth.oidc.refreshToken()`, which calls `/iam/v4/oidc/token` and sends `client_id`.

```ts
await blocks.auth.idp.redirectToProvider();

const result = await blocks.auth.idp.callback(window.location.href);

const refreshed = await blocks.auth.oidc.refreshToken({
  refreshToken: result.refresh_token,
  clientId: "<public-browser-client-id>"
});
```

Embedded/app-owned login UI uses AuthController methods directly on `auth`: `auth.login()`, `auth.socialInitiate()`, `auth.socialCallback()`, and `auth.refresh()`.

```ts
const login = await blocks.auth.login({
  username: "user@example.com",
  password: "password"
});

const refreshed = await blocks.auth.refresh({
  refreshToken: login.refresh_token
});
```

Other auth APIs, such as user info, organization switch, logout, signup, recovery, activation, auth config, user codes, client credentials, and identity providers, can be used by either flow when the app has the required token/permission.

`auth.oidc.clientCredentials()` is for trusted non-browser runtimes only because it requires a client secret.

## Common Runtime Calls

```ts
const me = await blocks.iam.me();
const orgs = await blocks.iam.organizations.my();
const features = await blocks.iam.resources.features();
```

```ts
const schemas = await blocks.data.schemas.list();
const schemaInfo = await blocks.data.schemas.infoByName("Student");
const schemaRules = await blocks.data.validations.bySchemaId("schema-id");

const students = blocks.data.collection("Students");
const rows = await students.list({ pageNo: 1, pageSize: 20 });
await students.create({ firstName: "Test" });

const graph = await blocks.data.graphql({
  query: "{ students { items { itemId firstName } } }"
});
```

```ts
const upload = await blocks.data.files.presignedUploadUrl({
  name: "avatar.png",
  configurationName: "default",
  parentDirectoryId: "root",
  accessModifier: "Private"
});

await blocks.data.files.uploadToUrl({
  url: upload.uploadUrl,
  body: file,
  contentType: file.type
});

const items = await blocks.data.dms.list({
  configurationName: "default",
  parentId: "root",
  skip: 0,
  take: 20
});
```

```ts
await blocks.localization.load("en-US", ["common", "dashboard"]);
const label = blocks.localization.t("dashboard.title", "Dashboard");

const tenantLanguages = await blocks.localization.languagesForCurrentTenant();
const selectedKeys = await blocks.localization.keysByNames({
  keyNames: ["dashboard.title"]
});
```

## API Surface

- `blocks.auth`: AuthController login, social login, refresh, org switch, logout, signup, recovery, activation, auth config, user codes, client credentials, identity providers.
- `blocks.auth.idp`: hosted IdP initiate, browser redirect, callback, UI config.
- `blocks.auth.oidc`: refresh-token and client-credentials token endpoint helpers.
- `blocks.iam`: current user, users, roles, permissions, resources, organizations, signup settings.
- `blocks.data`: schema reads, validation reads, GraphQL gateway execution, file/storage helpers, DMS file/folder helpers, runtime collection CRUD.
- `blocks.localization`: tenant language/module discovery, UILM dictionary loading, selected key lookup, simple `t()` lookup.

Professional class names are exported for advanced typing and adapters: `BlocksAuthenticationClient`, `BlocksIAMClient`, `BlocksDataClient`, and `BlocksLocalizationClient`.

## Boundaries

This package must not contain:

- CLI client secrets
- impersonation APIs
- project create/list/use
- schema/rules deploy
- release deploy
- token/session/PKCE storage
- Node filesystem or OS credential storage
- framework UI components
- Localization authoring/admin endpoints
- Data schema/rules mutation endpoints

## Package Checks

```bash
npm test
npm pack --dry-run
```
