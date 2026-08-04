---
name: blocks-iam-sso-oidc-implementation
description: "Extend, debug, or explain the hosted SSO/OIDC login flow that `blocks new web` already scaffolds into every Blocks app — this skill documents that generated flow, it does not build one from scratch. Covers: `src/features/auth/LoginPage.tsx` (login button, disabled with a setup notice until OIDC config is present), `src/features/auth/CallbackPage.tsx` (the `/login/callback` handler), `src/app/providers/AuthProvider.tsx` (session status/claims via polling + visibility-change), `src/app/router/guards.tsx` (`RequireAuth` / `RedirectIfAuthenticated`), and `src/lib/blocks/auth.ts` + `src/lib/blocks/client.ts` (the `@seliseblocks/client` wiring: `auth.idp.initiate`/`redirectToProvider`/`callback`/`uiConfig`, `auth.oidc.refreshToken`, `auth.isAuthenticated`/`auth.userInfo`). Use whenever a user wants to add a login button, handle the OIDC callback, add/adjust a protected route, fix 'login button is disabled', debug a redirect loop or a session that doesn't stick, wire the 401-retry/refresh path, or understand how a scaffolded app's auth state works — on an app already created by `blocks new web`. NEVER write raw `fetch`/`curl` against `/iam/v4/...` — every call here goes through the app's single `blocksClient` (`@seliseblocks/client`). Requires a registered public OIDC client (portal-only, see `blocks-iam-sso-oidc-configuration`) and, for real login testing, HTTPS on the project's real domain (see `blocks-frontend-local-https`) — this skill doesn't repeat either."
---

# Blocks IAM — SSO / OIDC Implementation (scaffolded frontend)

`blocks new web <name>` already generates a complete, working hosted-login flow. Don't reinvent it — read what's there, extend it, or fix it. Every Blocks call in this flow goes through the single `blocksClient` instance (`src/lib/blocks/client.ts`, `@seliseblocks/client`); there is no raw `fetch`/`curl` anywhere in this stack.

## The files, and what each one actually does

| File | Role |
|---|---|
| `src/lib/blocks/config.ts` | Reads `VITE_BLOCKS_*` env vars; `isLoginConfigured()` = `apiUrl && oidcUrl && oidcClientId` all present |
| `src/lib/blocks/client.ts` | The one `blocksClient = createBlocksClient({...})` instance, with `oidc: { clientId, scope, url: oidcUrl }` |
| `src/lib/blocks/auth.ts` | `startLogin`, `completeLogin`, `fetchSessionClaims`, `logout`, `getValidAccessToken` — the session/token logic |
| `src/lib/blocks/jwt.ts` | `decodeJwtPayload`/`isJwtExpired` — only relevant if a tenant's OIDC config returns bearer tokens in the body |
| `src/app/providers/AuthProvider.tsx` | React context: `status`/`claims`/`login`/`logout`/`refresh`, polling + visibility-driven refresh |
| `src/app/router/guards.tsx` | `RequireAuth`, `RedirectIfAuthenticated` |
| `src/app/router/routes.tsx` | Wires `/login`, `/login/callback`, and the protected route table (`/`, `/assets`, `/profile`, `/error`) |
| `src/features/auth/LoginPage.tsx` | The login button |
| `src/features/auth/CallbackPage.tsx` | The `/login/callback` handler |

## The flow, traced through the generated code

1. **Login button.** `LoginPage`'s button calls `useAuth().login(returnTo)`, which is `AuthProvider`'s `login` calling `startLogin(returnTo)` in `lib/blocks/auth.ts`. `startLogin` throws a clear error if `oidcClientId` isn't set (`"Login is not configured. Set VITE_BLOCKS_OIDC_CLIENT_ID in .env."`), stashes `returnTo` (default `"/"`) in `sessionStorage`, then calls `blocksClient.auth.idp.redirectToProvider()` with no arguments — it relies entirely on the client's configured `oidc` defaults.
   - The button itself is `disabled={!configured || pending}` — if `isLoginConfigured()` is false, `LoginPage` renders a warning `Alert` with the exact callback URL (`{origin}/login/callback`) to register, instead of letting the click fail. **"Login button does nothing" is almost always an empty `VITE_BLOCKS_OIDC_CLIENT_ID`.**
2. **`redirectToProvider()`** (SDK, `auth-client.ts`) calls `auth.idp.initiate()` — `GET /iam/v4/idp/initiate` — then `window.location.assign(response.redirect_uri)`. `initiate` itself is also directly callable (e.g. to get the URL without immediately navigating, such as opening it in a new tab) but the scaffold never calls it directly; only `redirectToProvider` is wired to the button.
3. The user authenticates on Blocks-hosted IAM.
4. IAM redirects back to `<origin>/login/callback?code=...&state=...`. That path is the SDK's *default* `redirectUri` — the scaffold's `client.ts` never passes an explicit `redirectUri`, so `createBlocksClient` derives `${window.location.origin}/login/callback` at runtime (see `browserRedirectUri()` in the SDK's `client.ts`). This is exactly the route `routes.tsx` handles, so it lines up with zero config — **but** it means the OIDC client's registered `redirect_uris` must include `/login/callback` under **every origin** this app runs on (dev HTTPS origin and prod origin both — see the scaffold's own README and `blocks-iam-sso-oidc-configuration`).
5. `routes.tsx` matches `path === "/login/callback"` and renders `CallbackPage` directly — **not** wrapped in `RequireAuth` or `RedirectIfAuthenticated`, since the user is by definition not yet authenticated when they land here.
6. `CallbackPage`'s one-shot effect (guarded with a `useRef` so React 18 Strict Mode's double-invoke doesn't run it twice) calls `completeLogin(window.location.href)`. `completeLogin` reads and clears the stashed `returnTo`, then calls `blocksClient.auth.idp.callback(callbackUrl)` — `GET /iam/v4/idp/callback` — passing the full URL so the SDK parses `code`/`state`/`error` itself.
   - On the default cookie flow, IAM sets the session as a **Secure, httpOnly cookie** via `Set-Cookie` on this response and returns no token in the body — `completeLogin` only caches a bearer token if the response body actually contains one (a non-default, explicit-token OIDC config). The SDK never stores tokens itself either way; every call sets `credentials: "include"` so the cookie rides along automatically once IAM has set it.
   - If `data.error` is present, `completeLogin` returns `{ ok: false, message }` and `CallbackPage` shows an inline error `Alert` plus a button back to `/login` — it never silently strands the user on a blank screen.
7. On success, `CallbackPage` calls `refresh()` (from `AuthProvider`) and then `onNavigate(result.returnTo)`. `refresh()` calls `fetchSessionClaims()` → `blocksClient.auth.userInfo()` (`GET /iam/v4/auth/me`) to confirm the cookie actually landed and to populate `claims`/`status` before the app navigates away from the callback screen.

## Session state and route guards

- **`AuthProvider`** is the single source of truth for `status` (`"loading" | "authenticated" | "unauthenticated"`) and `claims`. It calls `refresh()` on mount, every 5 minutes (`STATUS_POLL_MS`, a backup interval — not the primary signal), and immediately whenever the tab regains visibility (catches sign-out in another tab or session expiry while backgrounded). It never inspects local storage to decide auth state — IAM's `/iam/v4/auth/me` is the only source of truth, because the default flow holds no locally readable token by design.
- **`RequireAuth`** wraps every protected route in `routes.tsx` (`/`, `/assets`, `/profile`, `/error`). While `status !== "authenticated"` it renders `LoadingScreen`; once `status` resolves to `"unauthenticated"` it navigates to `/login?returnTo=<currentPath>` from a `useEffect` (not render-time — reading `window.location` live at render would double-nest the `returnTo` param under Strict Mode's double-invoked effects).
- **`RedirectIfAuthenticated`** wraps `/login` itself so an already-signed-in user hitting `/login` bounces straight to `/` instead of seeing the login button again.
- Adding a new protected page: add it to the `protectedRoutes` map in `routes.tsx` — it's automatically wrapped in `RequireAuth` and `AppShell` by the existing router code, nothing else to wire.

## The `@seliseblocks/client` methods behind all of this

All under `blocksClient.auth`:

- **`idp.initiate(request?)`** — `GET /iam/v4/idp/initiate` — starts the flow, returns `{ redirect_uri }`. Uses the client's configured `oidc` defaults (`clientId`, `redirectUri`) unless you pass overrides per call.
- **`idp.redirectToProvider(request?)`** — calls `initiate` then `window.location.assign(...)`. This is what `startLogin` (and therefore the login button) actually calls; reach for this directly in any new login entry point rather than re-implementing initiate+navigate.
- **`idp.callback(callbackUrlOrObject)`** — `GET /iam/v4/idp/callback` — completes the flow. Pass `window.location.href` directly (what `completeLogin` does), or `{ code, state, error?, error_description? }` if you've parsed the URL yourself. Returns IAM's auth response as-is; the SDK never stores tokens — your app decides what, if anything, to keep (the scaffold keeps nothing in the default cookie flow).
- **`idp.uiConfig()`** — `GET /iam/v4/idp/oidc-ui-config` — public UI config (e.g. captcha settings). **Not currently called anywhere in the scaffold** — if you're extending `LoginPage` with captcha or tenant-specific login UI, call this before rendering that UI, not before.
- **`oidc.refreshToken(request?)`** — `POST /iam/v4/oidc/token`, `grant_type=refresh_token` — a separate endpoint from the IdP-controller hosted flow. `getValidAccessToken()` in `lib/blocks/auth.ts` is already wired as the 401-retry/expiry path: it returns a cached, unexpired token if present, otherwise calls this (de-duplicating concurrent callers via `refreshInFlight`) if a refresh token happens to be cached. In the default cookie-only flow there's usually nothing cached to refresh, so this mostly matters for tenants whose OIDC config explicitly returns tokens in the response body.
- **`isAuthenticated()`** — `GET /iam/v4/auth/me`, returns a plain boolean. The scaffold's own `fetchSessionClaims()` calls the lower-level `userInfo()` instead (same endpoint) because `AuthProvider` needs the claims payload, not just a boolean — reach for `isAuthenticated()` yourself for a one-off check that doesn't need claims, rather than hand-rolling another call to `/auth/me`.

## Config

`createBlocksClient` needs an `oidc` block: `clientId` (required), `url` (required — kept for app metadata, not used to build the authorize URL), `redirectUri`/`scope` (optional, default to `${origin}/login/callback` / `openid profile`). The scaffold populates this from `VITE_BLOCKS_OIDC_CLIENT_ID` / `VITE_BLOCKS_OIDC_URL` / `VITE_BLOCKS_OIDC_SCOPE` in `.env`.

**This `clientId` is the public OIDC client registered for *this app*** — configured portal-only, see the sibling **`blocks-iam-sso-oidc-configuration`** skill. Don't confuse it with `blocks login` itself, which authenticates the CLI with no setup and needs no registration at all (see **blocks-onboarding**) — the two are unrelated and neither can substitute for the other.

## Gotchas

- **Disabled login button, no error** → `isLoginConfigured()` is false, almost always because `VITE_BLOCKS_OIDC_CLIENT_ID` is empty in `.env`. `blocks new web` without `--client-id` scaffolds successfully but leaves this blank on purpose — fill it in once the public OIDC client exists.
- **Login redirects back but the app still shows logged out** → this is an HTTPS/cookie problem, not an app-logic bug — the session cookie is Secure and won't be stored/sent on `http://localhost`. Cross-reference **`blocks-frontend-local-https`** rather than debugging `AuthProvider`.
- **Redirect URI mismatch** → the SDK derives `redirectUri` from `window.location.origin` at runtime; if the app runs under more than one origin (dev HTTPS host, prod domain), the registered OIDC client's `redirect_uris` must list `/login/callback` under **each** of them, or IAM rejects the authorize request for the ones missing.
- **Activation is a separate concern.** Already-activated users go straight through this flow. Only users invited/created inactive via the portal or API need a one-time `/activate` step first — out of scope here, see **`blocks-iam-account`**.
- **Don't add a `RequireAuth`/`RedirectIfAuthenticated` guard around `/login/callback`** — it must stay reachable while the user is still unauthenticated, by design.
- **Don't hand-roll a "check if logged in" fetch** — call `blocksClient.auth.isAuthenticated()` or reuse `AuthProvider`'s `status`/`refresh()`, never infer auth state from `sessionStorage`/`localStorage` (the default flow keeps no readable token there at all).

## Example trigger prompts

- "Add a login button and handle the OIDC callback"
- "Why is my login button disabled?"
- "Add a new protected page that requires the user to be signed in"
- "The user gets redirected back from IAM but the app still shows them as logged out"
- "Wire up token refresh for when the session expires"
- "How does this scaffolded app know if someone is logged in?"
