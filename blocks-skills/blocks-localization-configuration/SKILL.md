---
name: blocks-localization-configuration
description: "Configure app translations (i18n) for a SELISE Blocks project through the blocks CLI — never raw fetch/curl against api.seliseblocks.com. Covers authoring local i18n JSON dictionaries under blocks/localization/<module>.<language>.json, validating them locally (blocks localization validate), pushing keys to the Localization service (blocks localization push, which also creates the translation module the first time it's used), and pulling published cloud translations back down (blocks localization pull). Use whenever the user wants to add or edit translations/labels for static UI text, set up a new translation module, translate a screen into another language, or sync local i18n files with the Blocks Localization service — 'add German translations for my login screen', 'push my localization changes', 'pull the latest translations', 'create a common module for shared strings'. Also clarifies what this skill does NOT cover: creating a brand-new language/culture for the tenant has no CLI command and no writable SDK method — it's a genuine capability gap today (portal-only if the OS portal exposes it), and a standalone 'create module' command doesn't exist either — a module is only ever created as a side effect of the first localization push into it. Do not invent commands for either."
---

# Blocks Localization — Configuration

Translations (i18n) for a Blocks project's static UI text — labels, titles, button copy — are authored locally as JSON and synced to the Localization service entirely through the `blocks` CLI. There is no supported reason to hand-roll `fetch`/`curl` calls against `api.seliseblocks.com/localization/v4` anymore, and there's no SDK-based authoring path either — `@seliseblocks/client`'s localization surface (`languages()`, `modules()`, `languagesForCurrentTenant()`, `translations()`, `cloudTranslations()`, `keysByNames()`) is entirely **read-only**, meant for apps to *consume* translations at runtime, not to author them. Authoring is CLI-only.

**Prerequisite:** `blocks init` has been run (creates `blocks/localization/`) and a project is selected (`blocks use <tenantId>`). If either is missing, or auth state is unknown, run the **[blocks-onboarding](../blocks-onboarding/SKILL.md)** skill first — it covers `auth status` probing, login, and project selection in detail; this skill assumes that's already done.

## The three commands

| Command | What it does |
|---|---|
| `blocks localization validate --module <name> --language <culture> [--file <path>] [--json]` | Validates a local i18n JSON dictionary. **Local-only, no API call.** |
| `blocks localization push --module <name> --language <culture> [--file <path>] [--route <route>] [--context <text>] [--dry-run] [--yes] [--json]` | Creates/updates keys from the local dictionary via `POST /localization/v4/Key/SaveKeys`. If the module doesn't exist yet, creates it first via `POST /localization/v4/Module/Save` — **this is the only way this tooling creates a module.** Mutating. |
| `blocks localization pull --module <name> --language <culture> [--out <path>] [--json]` | Downloads the **published** cloud dictionary via `GET /localization/v4/Key/GetCloudUilmFile` into a local JSON file. Read-only, overwrites the local file. |

`--module` is the feature-area bundle name (`common`, `login`, `dashboard`, …). `--language` is a culture code (`en`, `de-DE`, `bn-BD`, …) — see the culture-matching gotcha below before picking one.

## File convention

Local dictionaries default to:

```text
blocks/localization/<module>.<language>.json
```

for example `blocks/localization/login.de-DE.json`. Pass `--file`/`--out` to override the path. Content is a flat or nested JSON object of string values — nested objects are flattened with `.` before validation/push, so either of these is fine and produces the same keys:

```json
{ "login.title": "Anmelden", "login.submit": "Absenden" }
```

```json
{ "login": { "title": "Anmelden", "submit": "Absenden" } }
```

Key names must match `^[A-Za-z0-9][A-Za-z0-9._:-]*$` (letters, numbers, dot, dash, underscore, colon — no spaces) after flattening, and every value must be a non-empty string. `localization validate` enforces exactly this, locally, before anything touches the network.

## Workflow: add or update translations

1. **Generate or edit the local dictionary** at `blocks/localization/<module>.<language>.json` — write the JSON yourself (nested or flat), covering every key the screen/feature needs.
2. **Validate locally, no API call:**
   ```bash
   blocks localization validate --module login --language de-DE --json
   ```
   Fix every flagged key/value before moving on.
3. **Dry-run the push** to see exactly what would happen (module create-or-reuse, key count, target project):
   ```bash
   blocks localization push --module login --language de-DE --dry-run --json
   ```
4. **Get user approval, then push for real:**
   ```bash
   blocks localization push --module login --language de-DE --yes --json
   ```
   This is mutating. Never skip straight to `--yes`. Every key in the file is saved with `shouldPublish: true`, so a successful push is immediately live for `GetCloudUilmFile`/`GetUilmFile` reads — there is no separate "generate/publish" step in this CLI (unlike the old raw-API skill's `GenerateUilmFile` call).

Optional flags on `push`: `--route <route>` tags every key in this push with one route (e.g. the screen path the strings belong to); `--context <text>` attaches one context/hint string to every key in the push — both apply to the whole file, not per-key.

## Workflow: multiple languages for the same screen

Each `push` call carries exactly one `--language` (one culture stamped onto every key in that file). Translating one module into several languages means **one dictionary file and one push per language**, all against the same `--module`:

```bash
blocks localization validate --module login --language de-DE --json
blocks localization validate --module login --language bn-BD --json
blocks localization push --module login --language de-DE --dry-run --json
blocks localization push --module login --language bn-BD --dry-run --json
# after approval:
blocks localization push --module login --language de-DE --yes --json
blocks localization push --module login --language bn-BD --yes --json
```

The module (`login`) is only created on the *first* push that needs it; the second push reuses the module the first one created.

## Refreshing local files from the cloud

```bash
blocks localization pull --module login --language de-DE --out blocks/localization/login.de-DE.json --json
```

Use this to pull down what's actually published before editing further — same reasoning as pulling data schemas before editing them: don't blindly overwrite translations someone else edited in the portal or in a prior session.

## What this skill does NOT cover (and why)

Two things the old, pre-CLI version of this skill used to handle no longer have any supported path — do not paper over the gap by inventing a command or improvising a raw API call:

- **Creating a new language/culture for the tenant.** Neither the CLI nor the SDK exposes a write path for this. `blocks` has no `localization languages*` command at all, and `@seliseblocks/client`'s `localization.languages()` and `localization.languagesForCurrentTenant()` are both **read-only** (`GET /Language/Gets` and `GET /Language/GetLanguagesForCurrentTenant`) — listing only, no create/save/set-default equivalent anywhere in current tooling. If a user asks to "add German as a supported language" (as opposed to pushing German *translations* into an already-configured language), be explicit: this is a genuine capability gap in the current CLI/SDK, not something to fake with a workaround. Check whether the OS portal (`https://os.seliseblocks.com`) has a Localization/Languages section that supports it; if so, point the user there. Do not attempt this via a raw API call to `/localization/v4/Language/Save` — that bypasses the CLI-first rule and isn't validated tooling.
- **Creating a translation module on its own**, independent of pushing keys into it. There is no `localization modules create` or similar. A module only ever comes into existence as the implicit first step of `localization push` (via `/Module/Save`, when `/Module/Gets` doesn't already list it). If a user wants to "set up a new module" with no keys yet, the honest answer is: push at least one key into it — that's what creates it.
- **Listing existing languages or modules.** Unlike `data schema list`, there is no `localization languages list` or `localization modules list` command. To find out what's already configured, ask the user, check the OS portal, or infer from a `localization pull` (an empty result means no keys were found for that exact module+language pair, not proof the module/language doesn't exist).

Don't guess at endpoint paths or reconstruct the old skill's HTTP calls (`/Language/*`, `/Module/Gets`+manual save, `/Key/GenerateUilmFile`) for any of this — that old skill (`blocks-skills/skills/blocks-localization-configuration/`) is retained purely as historical reference and its REST patterns, including the separate "generate runtime files" step, are not how this tooling works today.

## Gotchas

- **`--dry-run` before `--yes`** on `localization push` — always. Same pattern as every other mutating `blocks` command.
- **`--language` is not validated against configured cultures.** `localization push` stamps whatever string you pass as `--language` directly into each key's `culture` field — it does not check that culture against the tenant's actual configured languages (it can't; there's no write path to languages, and push doesn't even read them). Get the culture code wrong (`de` instead of `de-DE`, or a culture the tenant never configured) and the key saves without error but may never surface at runtime, because runtime lookups match by the tenant's real configured `languageCode`. Confirm the exact culture code with the user (or the OS portal) before pushing, especially for less common languages like Bengali (`bn-BD` vs `bn`).
- **Module auto-create is silent and permanent.** The first push against a new `--module` name creates it via `/Module/Save` with no separate confirmation prompt beyond the push's own `--dry-run`/`--yes` gate — `--dry-run` output will tell you a module lookup happened, but won't distinguish "will create" from "already exists" as clearly as it could, so read the dry-run JSON's module info carefully, or ask the user to confirm the module name is intentional (typos become new, mostly-empty modules).
- **`localization validate` is local-only** — it confirms the JSON is well-formed and keys/values pass the naming rules; it does not confirm the push will succeed against the server (module resolution, auth, project selection). Still run `--dry-run` on the actual push.
- **One culture per file/push.** Don't try to cram multiple languages into one dictionary file — the format is flat key → string value, not key → {culture: value}. Multiple languages means multiple files and multiple push invocations (see above).
- **No standalone "generate" or "publish" step.** `shouldPublish: true` is baked into every key `localization push` sends — once the push succeeds, the translations are live. Don't go looking for a `localization generate` command; it doesn't exist and isn't needed.
- **Don't invent language-creation or module-creation commands.** They don't exist in the CLI or SDK today — say so plainly, check the portal, don't fake it with unrelated calls.

## Example trigger prompts

- "Add German translations for my login screen." → push `login.de-DE.json` after validate + dry-run + approval.
- "Add German and Bengali translations for my login screen." → two dictionary files, two validate/push pairs (`de-DE`, `bn-BD`), same module.
- "Set up a `common` module for shared strings like Save/Cancel/Delete." → write `common.<language>.json` with those keys, validate, push (this is what creates the `common` module).
- "Pull the latest translations for the dashboard module before I edit them." → `localization pull --module dashboard --language en`.
- "Validate my localization file before pushing." → `localization validate` only, no network call.
- "Can we add Bengali as a new supported language for the tenant?" → explain this is a capability gap: no CLI command, no writable SDK method; check the OS portal, don't improvise a `/Language/Save` call.
- "Create a new translation module called `billing` with no keys yet." → explain a module can't be created standalone; it's created implicitly by the first `localization push` into it — offer to push a starter key instead.
