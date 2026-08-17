# Starting a project on SELISE Blocks

You are starting work on an existing SELISE Blocks project. Everything needed
to begin is in this message. Nothing else has to be obtained first - there is
no API key to request, no portal step left to complete, and no credential to
collect from the user.

## Project context

x-blocks-key:
{{X_BLOCKS_KEY}}

App domain:
{{APP_DOMAIN}}

Both values are fixed and already correct for this project. Use them exactly as
given. Do not invent or substitute a project key, domain, OIDC client id, API
URL, token, or secret at any point.

## What you have to build with

**The Blocks CLI - `@seliseblocks/cli-os`.** Every project and admin operation
runs through it: login, project selection, OIDC clients, app scaffolding, data
schemas and rules, IAM, localization, release, secrets, mail, notifications and
storage. It also carries the task skills (step 6) and can print the SDK client
config without writing anything (step 5b). Never call the Blocks API with raw
`fetch`/`curl` when a CLI command already covers the work.

**The Blocks client SDK - `@seliseblocks/client`.** Everything the app itself
does at runtime in the browser: authentication, data and GraphQL, file storage,
localization and notifications. Configure it with `xBlocksKey`; it sends the
`x-blocks-key` header. Never use `ProjectKey` or `projectKey`, never put a
client secret in frontend code, and do not add `/api` after `/v4` in SDK routes.

That pair is the whole surface. If a task looks like it needs something else,
check `blocks --help` and the skills before reaching outside them.

## How to proceed

### 1. Find out what to build

If the user has not said what they want yet, ask - **once, in a single message,
as one short list**. Do not spread these over several turns, and do not run
anything that creates or changes something until they answer:

- App name, and what the app is for
- The main pages or screens
- The data it stores - entities and their fields
- Whether end users log in, and whether roles or permissions matter
- Anything involving languages, notifications, files, or deployment

Take whatever they give. Fill the gaps with sensible defaults, say which
defaults you chose, and continue - do not re-ask for what they skipped.

If they already described the app, do not ask again. Restate the scope in a few
lines with the defaults you are assuming, and get one confirmation before
scaffolding. Never assume a scope silently and start generating.

The app name and the feature work are the only open questions. The project key
and domain above are settled - do not ask the user for those.

### 2. Check the CLI

```bash
blocks --version
```

If it is missing, ask the user before installing anything globally:

```bash
npm install -g @seliseblocks/cli-os@latest
```

### 3. Log in and select this project

```bash
blocks login
blocks auth status --json
blocks use {{X_BLOCKS_KEY}}
blocks projects get --json
```

`blocks login` is a device-code flow: it prints a verification URL and user
code and opens the browser. There is nothing to register and no client id or
secret to collect for it. Run it yourself so you can read the printed code,
then verify with `auth status --json` rather than assuming it worked.
Show the user which project is selected before mutating anything.

### 4. Resolve the public OIDC client

```bash
blocks auth oidc-clients list --json
```

If none fits, create one through the CLI - no portal visit needed. Dry-run
first, show the user the output, then re-run with `--yes` once they approve:

```bash
blocks auth oidc-clients save \
  --client-display-name <appName> \
  --redirect-uris https://{{APP_HOST}}:5173/login/callback \
  --scope "openid profile" \
  --require-pkce \
  --register-as-identity-provider \
  --dry-run --json
```

Public PKCE client only. A create response can contain a `client_secret` shown
once - never print, log, or commit it, and never put a secret in frontend code.

### 5a. New app - scaffold it with the CLI

```bash
blocks new web <appName> \
  --x-blocks-key {{X_BLOCKS_KEY}} \
  --app-domain {{APP_DOMAIN}} \
  --client-id <publicOidcClientId>
```

`--app-domain` and `--client-id` are both mandatory in a scripted run: omitting
either drops the command into an interactive pick-list with no non-interactive
escape, which hangs the session. Leave `--blocks-api-url` off - the scaffold
derives it from the app domain as `https://blocksapi.<registrable-domain>`.

```bash
cd <appName>
npm install
npm run cert
npm run dev
```

`npm run cert` provisions the local HTTPS certificate for {{APP_HOST}}. Read the
generated `README.md` for the hosts-file entry and the redirect URI the app expects.

### 5b. Existing app - wire the client SDK

```bash
npm install @seliseblocks/client@latest
blocks sdk client \
  --x-blocks-key {{X_BLOCKS_KEY}} \
  --app-domain {{APP_DOMAIN}} \
  --client-id <publicOidcClientId> \
  --blocks-api-url https://blocksapi.<registrable-domain>
```

Use this path when the user already has an app instead of scaffolding a new
one. `sdk client` is read-only: it prints a `createBlocksClient(...)` config
and never writes a file or mutates anything. Passing both `--app-domain` and
`--client-id` skips the project lookup entirely, so it needs no login. Add
`--json` for the resolved values instead of the snippet.

`--blocks-api-url` is mandatory here. Unlike `new web`, `sdk client` does not
derive the API URL from the app domain - it falls back to the CLI's own
`https://api.seliseblocks.com`, which is a CLI-only URL and must never appear
in client SDK config. Pass the same value `new web` would have derived:
`https://blocksapi.<registrable-domain>`, where the registrable domain is the
last two labels of {{APP_DOMAIN}} (app domain `https://dqrsf.slsblx.com` ->
`https://blocksapi.slsblx.com`). If the printed snippet ever shows
`api.seliseblocks.com`, the flag was missed - fix it before pasting.

Configure the client with `xBlocksKey`; the SDK sends the `x-blocks-key`
header. Never use `ProjectKey` or `projectKey`, and do not add `/api` after
`/v4` in SDK routes.

### 6. Load the matching skill before building any feature

```bash
blocks skill list --json
blocks skill show <skill-name>
blocks skill add <skill-name>
```

Run `skill list` before any feature work and pick by the printed descriptions -
each one states what it covers and when to use it, including which sibling
skill owns the adjacent concern. Do not guess a skill name; if nothing fits,
check the full catalog link the command prints.

`skill add` copies the skill's whole directory into `./blocks-skills/<name>` so
it stays available in the project. Skills own the task workflow; this guide and
`blocks --help` own the command names - verify any command a skill mentions.

### 7. Data work

```bash
blocks init
```

Run once in the project directory when the work involves data schemas or rules.
It creates `blocks.json`, `blocks/data/schemas/`, `blocks/data/rules.json` and
`.env.example`, is safe to re-run, and never overwrites existing files.

### 8. Rules that apply throughout

- Run `--dry-run --json` first on every mutating command, show the user the
  output, and ask before re-running with `--yes`.
- Treat a GraphQL response carrying an `errors` array as a failure even when
  the HTTP status is 200.
- Never read, print, or expose the CLI's token or config storage files.
- Known fixes: `not_logged_in` -> `blocks login`; `project_not_selected` ->
  `blocks use {{X_BLOCKS_KEY}}`; a stuck project token -> `blocks deselect` then
  `blocks use {{X_BLOCKS_KEY}}`.
