---
name: blocks-frontend-local-https
description: "Run a scaffolded (`blocks new web`) Blocks app locally over HTTPS on its real project domain — required for hosted IAM login, since plain HTTP or localhost never gets the session cookie. The scaffold already automates cert generation (npm run cert, no OpenSSL needed) and HTTPS serving via vite.config.ts. Covers running that flow, trusting the cert, the hosts-file entry, and troubleshooting. Use when running a scaffolded app over HTTPS, hitting 'SSO cookie not set' / Vite 'Blocked request' errors, trusting the dev cert, or asking why local login redirects back but doesn't stay signed in."
---

# Blocks Frontend — Local HTTPS for a Scaffolded App

This is the local dev loop for an app already created with `blocks new web` (see [blocks-onboarding](../blocks-onboarding/SKILL.md) Step 4 for the scaffold command itself — this skill doesn't repeat it). The scaffold **already generates its own cert tooling**; nothing here is built from scratch, and nothing uses raw `openssl`/`curl`/`fetch`.

## Why localhost doesn't work

Browser login goes through the hosted Blocks IAM IdP flow (`blocksClient.auth.idp.redirectToProvider()` / `.callback()`), which finishes by IAM setting a **Secure, domain-scoped session cookie**. Browsers won't store or send that cookie on plain `http://localhost` — it has to be HTTPS, and it has to be on the project's real domain, or the cookie silently never lands and the app looks "logged in" for a second then bounces back to logged-out.

## Where the domain comes from

`--app-domain` on `blocks new web` is the app's real Blocks origin, e.g. `https://dbpdba.seliseblocks.com`. The generated `.env` keeps two derived values:

- `VITE_BLOCKS_APP_DOMAIN` — the full value as passed, with scheme (`https://dbpdba.seliseblocks.com`).
- `VITE_BLOCKS_DEV_HOST` — the same host with no scheme (`dbpdba.seliseblocks.com`), computed by the scaffold generator (`hostFromAppDomain` in `fs.ts`) and used everywhere locally: hosts file, cert `commonName`/SAN, and `vite.config.ts`'s `server.host`/`allowedHosts`.

You never need to look this up separately — it's already sitting in `.env` after scaffolding.

## The flow

```bash
cd <appName>
npm install
npm run cert
```

`npm run cert` runs `scripts/generate-cert.mjs`, which reads `VITE_BLOCKS_DEV_HOST` from `.env` (or `process.env`, or an explicit `npm run cert -- <domain>` argument) and uses the `selfsigned` npm dependency to write `.cert/dev-key.pem` and `.cert/dev-cert.pem`, with `subjectAltName` covering the domain, `localhost`, and `127.0.0.1`. This is pure Node — it works from a plain PowerShell prompt with no OpenSSL and no Git Bash/WSL switch.

Next, map the domain to your machine — add one line to the hosts file (needs admin/elevated):

```text
127.0.0.1 dbpdba.seliseblocks.com
```

Windows path: `C:\Windows\System32\drivers\etc\hosts` (edit as Administrator).

Then:

```bash
npm run dev
```

`vite.config.ts` picks up `.cert/dev-key.pem` + `.cert/dev-cert.pem` automatically when both exist and serves HTTPS on `VITE_BLOCKS_DEV_HOST`:`VITE_BLOCKS_DEV_PORT` (default port `5173`, `strictPort: true` because the port is baked into the registered OIDC redirect URI). It also sets `allowedHosts` to that domain, working around Vite's default DNS-rebinding protection which otherwise 404s custom hosts with "Blocked request."

Finally, open the app at:

```text
https://dbpdba.seliseblocks.com:5173
```

**Not** `http://`, **not** `localhost` — either one skips the cookie entirely even though the app loads.

## Trusting the cert (optional but recommended)

The cert is self-signed, so the browser shows a one-time warning until trusted. `npm run cert` prints the exact trust command for your OS when it finishes:

- Windows (elevated prompt): `certutil -addstore -f Root .cert\dev-cert.pem`
- macOS: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem`
- Linux: `sudo cp .cert/dev-cert.pem /usr/local/share/ca-certificates/blocks-dev.crt && sudo update-ca-certificates`

Restart the browser after trusting so it picks up the new trust store entry. `.cert/` is already gitignored by the scaffold — it's per-machine, never committed.

## Still need a public OIDC client

Local HTTPS alone doesn't make login succeed if no OIDC client is registered yet, or if its `redirect_uris` don't include this exact dev origin. That registration is portal-only (see blocks-onboarding's Gotchas) — out of scope here, but it's the next thing to check if HTTPS is right and login still fails. The redirect URI must match byte-for-byte, including `:5173`.

## Gotchas

**Custom app domain: the API base URL must share its registrable domain, or the cookie never lands.** `blocks new web --app-domain` isn't limited to `*.seliseblocks.com` — it also supports custom domains (e.g. `abc.slsblx.com`, `xyz.blx10.com`). On a custom domain, the hosted-login session cookie is only stored by the browser if `VITE_BLOCKS_API_URL` shares the app's registrable domain. Concretely:

- `abc.slsblx.com` → `VITE_BLOCKS_API_URL` must be `https://blocksapi.slsblx.com`
- `xyz.blx10.com` → `VITE_BLOCKS_API_URL` must be `https://blocksapi.blx10.com`

If `VITE_BLOCKS_API_URL` is left at the default `https://api.seliseblocks.com` while the app itself runs on a custom domain, the browser treats the API as cross-site relative to the app and never stores the cookie — login still redirects back and *looks* successful, but cookie-based calls (`/iam/me`, organization switching, logout) silently fail. Check `VITE_BLOCKS_API_URL` in `.env` first whenever the app domain is not `*.seliseblocks.com` and auth-dependent calls are failing despite HTTPS and the cert being set up correctly.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login redirects back but app shows logged-out | Opened on `http://` or `localhost` instead of the HTTPS dev host | Check the URL bar: must be `https://<VITE_BLOCKS_DEV_HOST>:5173` exactly |
| Browser "not private" warning | Self-signed cert not trusted yet | Run the OS trust command `npm run cert` printed, then restart the browser |
| Vite: "Blocked request. This host is not allowed" | `allowedHosts` doesn't include the host being requested — usually `.env`'s `VITE_BLOCKS_DEV_HOST` was edited/missing after scaffold, or the browser is hitting a different hostname than expected | Confirm `.env` has the right `VITE_BLOCKS_DEV_HOST` and that the URL bar matches it exactly |
| Page doesn't load at all / DNS error | Hosts file entry missing or wrong | Add `127.0.0.1 <VITE_BLOCKS_DEV_HOST>` to `C:\Windows\System32\drivers\etc\hosts` (as Administrator) |
| `npm run cert` errors "No domain given" | `.env` missing or `VITE_BLOCKS_DEV_HOST` not set | Confirm `.env` exists with `VITE_BLOCKS_DEV_HOST=<host>`, or run `npm run cert -- <domain>` explicitly |
| `npm run dev` fails to bind the port | Port 5173 already in use (dev server uses `strictPort`, won't fall back) | Free port 5173, or the port is fixed because it's part of the registered OIDC redirect URI — don't just change it without updating the OIDC client too |
| HTTPS works, cert trusted, login still fails | No OIDC client registered yet, or its redirect URI doesn't match this origin exactly | Register/update the public OIDC client in the portal with `https://<VITE_BLOCKS_DEV_HOST>:5173/login/callback` as a redirect URI (portal-only, see blocks-onboarding) |
| Works for one dev, fails for a teammate | Each machine needs its own cert + hosts entry — `.cert/` is gitignored on purpose | Teammate runs `npm run cert` and adds the hosts entry on their own machine |

## Example trigger prompts

- "Run my app locally over HTTPS on its real domain so SSO works"
- "My local login isn't working — it just bounces back to the login page"
- "How do I set up the dev cert for this scaffolded app?"
- "I'm getting 'Blocked request. This host is not allowed' from Vite"
- "Do I need OpenSSL to run npm run cert on Windows?"
- "Why does login work in production but not on localhost?"
