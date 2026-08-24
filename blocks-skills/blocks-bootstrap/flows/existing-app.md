# Flow: Wiring an app that already exists

For an application that was not created by `blocks new web` — an existing frontend that now needs to talk to Blocks. The work is the same as the scaffold's, minus the code generation, plus the steps the scaffold would otherwise have done silently.

Run everything from the existing app's root.

## 1. Install the SDK

```bash
npm install @seliseblocks/client@latest
```

All Blocks access from app code goes through a single `createBlocksClient()` instance, created once and reused. Never hand-roll `fetch`/`curl` against a Blocks API from application code.

## 2. Gather the four values from commands, not memory

```bash
blocks projects get --json          # app domain, environment
blocks auth oidc-clients list --json # the public client id
```

The client config needs the API URL, the project key, the OIDC client id, and the OIDC URL. Read each one from output. Never invent a project key, domain, API URL, or client id, and never copy one from another project's config file because it "looks right".

Two naming rules that cause silent, confusing failures:

- The config field is **`xBlocksKey`** — the SDK sends it as the `x-blocks-key` header. `ProjectKey` and `projectKey` are wrong and will not be recognised.
- **Do not add `/api` after `/v4`** in any route.

## 3. Do what the scaffold would have done for you

`blocks new web` enables OIDC login on the project once it resolves a client id. Nothing does that here, so check it yourself:

```bash
blocks auth config get --json
```

If `isOidcEnabled` is `false`, turn it on through the OIDC flow. This is the most common reason a correctly wired existing app still shows no login screen.

Then confirm the OIDC client's redirect URI matches **this** app's real callback URL, including port, for every environment it runs in — local dev included. A client registered against a scaffolded app's domain will not authorize a different app on a different port.

## 4. Project-local Blocks files

```bash
blocks init
```

Run it from the app root, and only when the work needs `blocks.json` and a `blocks/` directory — data schemas, rules, and similar. Safe to re-run; it never overwrites an existing file.

## 5. Write the login code

The app-side work — login button, callback route, session handling, route guards, token refresh — is owned by `blocks-iam-sso-oidc-implementation`. Follow it rather than improvising an OIDC flow by hand; the SDK already implements the redirect and callback halves.

## Verify

Complete one real login in the existing app, then confirm the session is real from app code rather than from the presence of a token.

## Done when

- The app has one shared client instance configured from command output.
- `isOidcEnabled` is true and the redirect URI matches this app's actual callback URL.
- A real user logs in successfully.
- No client secret appears anywhere in the frontend.
