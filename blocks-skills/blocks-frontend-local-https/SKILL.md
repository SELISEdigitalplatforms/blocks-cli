---
name: blocks-frontend-local-https
description: "Run a scaffolded (`blocks new web`) Blocks app locally over HTTPS on its real project domain — required for hosted IAM login, since plain HTTP or localhost never gets the session cookie. The scaffold already automates cert generation (npm run cert, no OpenSSL needed) and HTTPS serving via vite.config.ts. Covers running that flow, trusting the cert, the hosts-file entry, and troubleshooting. Use when running a scaffolded app over HTTPS, hitting 'SSO cookie not set' / Vite 'Blocked request' errors, trusting the dev cert, or asking why local login redirects back but doesn't stay signed in."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Frontend — Local HTTPS for a Scaffolded App

The local dev loop for an app already created with `blocks new web` (blocks-bootstrap covers the scaffold command itself). The scaffold **already generates its own cert tooling** — nothing here is built from scratch, and nothing uses raw `openssl`/`curl`/`fetch`.

## Why localhost doesn't work

Browser login runs the hosted Blocks IAM IdP flow (`blocksClient.auth.idp.redirectToProvider()` / `.callback()`), which ends with IAM setting a **Secure, domain-scoped session cookie**. Browsers won't store or send that on plain `http://localhost` — it needs HTTPS *and* the project's real domain. Otherwise the cookie silently never lands: the app looks "logged in" for a second, then bounces back to logged-out.

## Where the domain comes from

`--app-domain` on `blocks new web` is the app's real Blocks origin, e.g. `https://dbpdba.seliseblocks.com`. The generated `.env` already holds both derived values — never look them up separately:

- `VITE_BLOCKS_APP_DOMAIN` — the full value as passed, with scheme (`https://dbpdba.seliseblocks.com`).
- `VITE_BLOCKS_DEV_HOST` — the same host with no scheme (`dbpdba.seliseblocks.com`), computed by the scaffold generator and used everywhere locally: hosts file, cert `commonName`/SAN, and `vite.config.ts`'s `server.host`/`allowedHosts`.

## The flow

```bash
cd <appName>
npm install
npm run cert
```

`npm run cert` runs `scripts/generate-cert.mjs`: it reads `VITE_BLOCKS_DEV_HOST` from `.env` (or `process.env`, or an explicit `npm run cert -- <domain>`) and uses the `selfsigned` npm dependency to write `.cert/dev-key.pem` and `.cert/dev-cert.pem`, with `subjectAltName` covering the domain, `localhost`, and `127.0.0.1`. Pure Node — it works from a plain PowerShell prompt, with no OpenSSL and no Git Bash/WSL switch.

**Next, map the domain to your machine — add the hosts entry yourself; do not ask the user to edit the hosts file.** Read `VITE_BLOCKS_DEV_HOST` from the app's `.env`, run the matching command below, then tell the user it was added (they'll see a UAC / `sudo` prompt). Both commands are idempotent — they skip non-comment lines that already map the host.

Windows — writes a one-shot script and runs it elevated, so the only thing the user touches is the UAC prompt:

```powershell
$devHost = (Select-String -Path .env -Pattern '^VITE_BLOCKS_DEV_HOST=(.*)$').Matches[0].Groups[1].Value.Trim()
$ps = Join-Path $env:TEMP 'blocks-add-hosts-entry.ps1'
@'
param([string]$DevHost)
$p = "$env:WINDIR\System32\drivers\etc\hosts"
$rx = "(^|\s)$([regex]::Escape($DevHost))(\s|$)"
$active = @(Get-Content $p | Where-Object { $_ -notmatch '^\s*#' -and $_ -match $rx })
if ($active.Count -eq 0) { Add-Content -Path $p -Value "127.0.0.1 $DevHost" }
'@ | Set-Content -Encoding ASCII $ps
Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',$ps,$devHost
Remove-Item $ps -ErrorAction SilentlyContinue
Select-String -Path "$env:WINDIR\System32\drivers\etc\hosts" -Pattern ([regex]::Escape($devHost))
```

macOS / Linux:

```bash
devHost=$(grep -E '^VITE_BLOCKS_DEV_HOST=' .env | head -1 | cut -d= -f2- | tr -d '[:space:]')
if ! grep -vE '^[[:space:]]*#' /etc/hosts | grep -qE "(^|[[:space:]])${devHost}([[:space:]]|$)"; then
  echo "127.0.0.1 ${devHost}" | sudo tee -a /etc/hosts
fi
grep "$devHost" /etc/hosts
```

Each snippet's last line prints the resulting mapping — confirm it reads `127.0.0.1 <VITE_BLOCKS_DEV_HOST>`. If the host is already mapped to a *different* IP, don't append a second line: say which line conflicts and let the user decide.

Then:

```bash
npm run dev
```

`vite.config.ts` picks up `.cert/dev-key.pem` + `.cert/dev-cert.pem` automatically when both exist, and serves HTTPS on `VITE_BLOCKS_DEV_HOST`:`VITE_BLOCKS_DEV_PORT` (default port `5173`, `strictPort: true` because the port is baked into the registered OIDC redirect URI). It also sets `allowedHosts` to that domain, working around Vite's default DNS-rebinding protection, which otherwise 404s custom hosts with "Blocked request."

Finally, open the app at:

```text
https://dbpdba.seliseblocks.com:5173
```

**Not** `http://`, **not** `localhost` — either one skips the cookie entirely even though the app loads.

## Trusting the cert (optional but recommended)

The cert is self-signed, so the browser warns once until it's trusted. `npm run cert` prints the exact command for your OS when it finishes:

- Windows (elevated prompt): `certutil -addstore -f Root .cert\dev-cert.pem`
- macOS: `sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain .cert/dev-cert.pem`
- Linux: `sudo cp .cert/dev-cert.pem /usr/local/share/ca-certificates/blocks-dev.crt && sudo update-ca-certificates`

Restart the browser afterwards so it picks up the new trust store entry. `.cert/` is gitignored by the scaffold — per-machine, never committed.

## Still need a public OIDC client

Local HTTPS alone doesn't make login succeed if no OIDC client is registered yet, or if its `redirect_uris` don't include this exact dev origin — the URI must match byte-for-byte, including `:5173`. That registration is portal-only (see blocks-bootstrap's Gotchas): out of scope here, but it's the next thing to check when HTTPS is right and login still fails.

## Gotchas

**Custom app domain: `VITE_BLOCKS_API_URL` must share the app's registrable domain, or the cookie never lands.** `blocks new web --app-domain` isn't limited to `*.seliseblocks.com` — custom domains work too:

- `abc.slsblx.com` → `VITE_BLOCKS_API_URL` must be `https://blocksapi.slsblx.com`
- `xyz.blx10.com` → `VITE_BLOCKS_API_URL` must be `https://blocksapi.blx10.com`

Left at the default `https://api.seliseblocks.com` while the app runs on a custom domain, the browser treats the API as cross-site and never stores the cookie — login still redirects back and *looks* successful, but cookie-based calls (`/iam/me`, organization switching, logout) silently fail. Check `VITE_BLOCKS_API_URL` in `.env` first whenever the app domain isn't `*.seliseblocks.com` and auth-dependent calls fail despite correct HTTPS and cert.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login redirects back but app shows logged-out | Opened on `http://` or `localhost` instead of the HTTPS dev host | URL bar must read `https://<VITE_BLOCKS_DEV_HOST>:5173` exactly |
| Browser "not private" warning | Self-signed cert not trusted yet | Run the OS trust command `npm run cert` printed, then restart the browser |
| Vite: "Blocked request. This host is not allowed" | `allowedHosts` doesn't cover the requested host — usually `.env`'s `VITE_BLOCKS_DEV_HOST` was edited or lost after scaffold, or the browser is on a different hostname | Confirm `.env` has the right `VITE_BLOCKS_DEV_HOST` and that the URL bar matches it exactly |
| Page doesn't load at all / DNS error | Hosts entry missing or wrong | Re-run the hosts command from **The flow** yourself (elevated) and check the printed mapping — don't hand the user a line to paste |
| `npm run cert` errors "No domain given" | `.env` missing or `VITE_BLOCKS_DEV_HOST` not set | Confirm `.env` exists with `VITE_BLOCKS_DEV_HOST=<host>`, or run `npm run cert -- <domain>` explicitly |
| `npm run dev` fails to bind the port | Port 5173 already in use (`strictPort`, so no fallback) | Free port 5173 — don't just change it, the port is part of the registered OIDC redirect URI and would have to be updated there too |
| HTTPS works, cert trusted, login still fails | No OIDC client registered, or its redirect URI doesn't match this origin exactly | Register/update the public OIDC client in the portal with `https://<VITE_BLOCKS_DEV_HOST>:5173/login/callback` (portal-only, see blocks-bootstrap) |
| Works for one dev, fails for a teammate | Each machine needs its own cert + hosts entry — `.cert/` is gitignored on purpose | On that machine, run `npm run cert` and the hosts command from **The flow** |

## Example trigger prompts

- "Run my app locally over HTTPS on its real domain so SSO works"
- "My local login isn't working — it just bounces back to the login page"
- "How do I set up the dev cert for this scaffolded app?"
- "I'm getting 'Blocked request. This host is not allowed' from Vite"
- "Do I need OpenSSL to run npm run cert on Windows?"
- "Why does login work in production but not on localhost?"
