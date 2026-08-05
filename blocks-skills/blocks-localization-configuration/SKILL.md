---
name: blocks-localization-configuration
description: "Configure app translations (i18n) for a SELISE Blocks project through the `blocks` CLI — never raw fetch/curl. Covers authoring local i18n JSON dictionaries, validate/push/pull with the Localization service, managing languages and modules directly, glossary terms, AI translation suggestions, and the composed translate-and-export flow. Use for 'add translations for my login screen', 'push/pull localization changes', 'create a module', 'add a new language'."
---

# Blocks Localization — Configuration

Translations (i18n) for a Blocks project's static UI text — labels, titles, button copy — are authored locally as JSON and synced to the Localization service entirely through the `blocks` CLI. There is no supported reason to hand-roll raw `fetch`/`curl` calls anymore, and there's no SDK-based authoring path either — `@seliseblocks/client`'s localization surface (`languages()`, `modules()`, `languagesForCurrentTenant()`, `translations()`, `cloudTranslations()`, `keysByNames()`) is entirely **read-only**, meant for apps to *consume* translations at runtime, not to author them. Authoring is CLI-only.

**Prerequisite:** `blocks init` has been run and a project is selected (`blocks use <tenantId>`). Note `blocks init` does **not** create a `blocks/localization/` folder — it only scaffolds `blocks/data/schemas/`, `blocks/data/rules.json`, and `.env.example`. The `blocks/localization/` directory and its dictionary files come into existence lazily, the first time `blocks localization pull` writes one out (or the first time you author one by hand). If either the project selection is missing, or auth state is unknown, run the blocks-onboarding skill first — it covers `auth status` probing, login, and project selection in detail; this skill assumes that's already done.

## The three commands

| Command | What it does |
|---|---|
| `blocks localization validate --module <name> --language <culture> [--file <path>] [--json]` | Validates a local i18n JSON dictionary. **Local-only, no API call.** |
| `blocks localization push --module <name> --language <culture> [--file <path>] [--route <route>] [--context <text>] [--dry-run] [--yes] [--json]` | Creates/updates keys from the local dictionary. If the module doesn't exist yet, creates it first — **this is the only way this tooling creates a module.** Mutating. |
| `blocks localization pull --module <name> --language <culture> [--out <path>] [--json]` | Downloads the **published** cloud dictionary into a local JSON file. Read-only, overwrites the local file. |

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
   This is mutating. Never skip straight to `--yes`. Every key in the file is saved as immediately published, so a successful push is live for reads right away — there is no separate "generate/publish" step in this CLI.

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

## Managing languages directly

Pushing translations into an existing language and *configuring the tenant's set of languages* are different operations — the latter has its own standalone commands, independent of `push`/`pull`:

| Command | What it does |
|---|---|
| `blocks localization language save --language-name <n> --language-code <c> [--is-default] [--item-id <id>] [--dry-run] [--yes] [--json]` | Creates or updates a language. Omit `--item-id` to create a new one. Mutating, full dry-run/confirm gate. |
| `blocks localization language delete <languageName> [--dry-run] [--yes] [--json]` | Deletes a language. Mutating. |
| `blocks localization language set-default <languageName> [--dry-run] [--yes] [--json]` | Marks a language as the tenant default. Mutating. |
| `blocks localization language list [--json]` | Lists all languages. Read-only. |
| `blocks localization language list-for-tenant [--json]` | Lists languages configured for the current tenant. Read-only. |

So "add German as a supported language for the tenant" is a real, supported request: `blocks localization language save --language-name German --language-code de-DE --dry-run`, get approval, then re-run with `--yes`. This is distinct from `localization push --language de-DE`, which stamps translations onto keys and doesn't touch the tenant's language configuration at all.

## Managing modules directly

A module is still created implicitly by the first `localization push` into it, but it can also be created or updated on its own, with no keys, via a standalone command:

| Command | What it does |
|---|---|
| `blocks localization module save --module-name <n> [--item-id <id>] [--dry-run] [--yes] [--json]` | Creates or updates a module. Omit `--item-id` to create a new one. Mutating. |
| `blocks localization module list [--json]` | Lists all modules. Read-only. |
| `blocks localization module list-for-tenant [--json]` | Lists modules configured for the current tenant. Read-only. |

So "create a `billing` module with no keys yet" is directly supported: `blocks localization module save --module-name billing --dry-run` → approve → `--yes`. `localization push`'s implicit module creation is just a convenience on top of the same underlying call, not the only path to it.

## Other localization commands

A few more commands round out the surface beyond push/pull/validate/language/module — useful, but secondary to the core authoring workflow above:

| Command | What it does |
|---|---|
| `blocks localization key translate-and-export --module-id <id> [--wait] [--dry-run] [--yes] [--json]` | Composed flow: `translate-all` (machine-translates every untranslated key in the module) → if `--wait`, polls until the operation settles → `generate-uilm-file` → `uilm-export`. Without `--wait` the three steps just fire back-to-back. Mutating. |
| `blocks localization glossary save --name <n> [--item-id <id>] [--language <c>] [--type <t>] [--context <text>] [--additional-note <text>] [--is-global] [--module-ids a,b] [--dry-run] [--yes] [--json]` | Creates or updates a glossary term. Mutating. |
| `blocks localization glossary list [--search <text>] [--module-id <id>] [--is-global] [--page-number <n>] [--page-size <n>] [--json]` | Lists glossary terms. Read-only. |
| `blocks localization glossary get <itemId> [--json]` | Fetches one glossary term. Read-only. |
| `blocks localization glossary suggested <itemId> [--max-results <n>] [--json]` | Suggests glossary terms relevant to an item. Read-only. |
| `blocks localization glossary delete <itemId> [--dry-run] [--yes] [--json]` | Deletes a glossary term. Mutating. |
| `blocks localization assistant translation-suggestion --source-text <text> [--current-language <c>] [--destination-language <name>] [--destination-language-code <c>] [--module-id <id>] [--glossary-ids a,b] [--element-type <t>] [--element-application-context <text>] [--element-detail-context <text>] [--max-character-length <n>] [--temperature <n>] [--json]` | Gets an AI translation suggestion for a single string. Read-only (no confirm gate). |
| `blocks localization config get-webhook [--json]` | Gets the tenant's localization webhook config. Read-only. |
| `blocks localization config save-webhook --url <url> --content-type <type> --secret <s> --header-key <k> [--is-disabled] [--item-id <id>] [--dry-run] [--yes] [--json]` | Saves the tenant's localization webhook config. Mutating; the secret is redacted in `--dry-run` output. |

## Gotchas

- **`--dry-run` before `--yes`** on `localization push` — always. Same pattern as every other mutating `blocks` command.
- **`--language` on `push` is not validated against configured cultures.** `localization push` stamps whatever string you pass as `--language` directly into each key's `culture` field — it does not check that culture against the tenant's actual configured languages, and doesn't call `language list`/`list-for-tenant` to look. Get the culture code wrong (`de` instead of `de-DE`, or a culture the tenant never configured via `language save`) and the key saves without error but may never surface at runtime, because runtime lookups match by the tenant's real configured `languageCode`. Confirm the exact culture code with the user (or run `localization language list-for-tenant`) before pushing, especially for less common languages like Bengali (`bn-BD` vs `bn`).
- **Module auto-create is silent and permanent.** The first push against a new `--module` name creates it with no separate confirmation prompt beyond the push's own `--dry-run`/`--yes` gate — `--dry-run` output will tell you a module lookup happened, but won't distinguish "will create" from "already exists" as clearly as it could, so read the dry-run JSON's module info carefully, or ask the user to confirm the module name is intentional (typos become new, mostly-empty modules). Prefer `localization module save` first if the user wants the module created deliberately, without an accompanying key push.
- **`localization validate` is local-only** — it confirms the JSON is well-formed and keys/values pass the naming rules; it does not confirm the push will succeed against the server (module resolution, auth, project selection). Still run `--dry-run` on the actual push.
- **One culture per file/push.** Don't try to cram multiple languages into one dictionary file — the format is flat key → string value, not key → {culture: value}. Multiple languages means multiple files and multiple push invocations (see above).
- **No standalone "generate" or "publish" step for `push`.** `shouldPublish: true` is baked into every key `localization push` sends — once the push succeeds, the translations are live. That's separate from `key generate-uilm-file`/`key uilm-export` (and the composed `key translate-and-export`), which build downloadable runtime language files rather than affect `push`'s own publish behavior.
- **`language delete` and `set-default` are permanent, mutating calls** — always dry-run first, and confirm with the user before deleting a language or changing the tenant default, since either can affect what's visible at runtime for existing translations.

## Example trigger prompts

- "Add German translations for my login screen." → push `login.de-DE.json` after validate + dry-run + approval.
- "Add German and Bengali translations for my login screen." → two dictionary files, two validate/push pairs (`de-DE`, `bn-BD`), same module.
- "Set up a `common` module for shared strings like Save/Cancel/Delete." → write `common.<language>.json` with those keys, validate, push (this is what creates the `common` module) — or use `localization module save --module-name common` directly if no keys exist yet.
- "Pull the latest translations for the dashboard module before I edit them." → `localization pull --module dashboard --language en`.
- "Validate my localization file before pushing." → `localization validate` only, no network call.
- "Can we add Bengali as a new supported language for the tenant?" → `localization language save --language-name Bengali --language-code bn-BD --dry-run`, confirm, then `--yes`.
- "Create a new translation module called `billing` with no keys yet." → `localization module save --module-name billing --dry-run` → confirm → `--yes`.
- "Machine-translate the whole `login` module and give me the export." → `localization key translate-and-export --module-id <id> --wait --dry-run` → confirm → `--yes`.
- "Suggest a translation for this button label." → `localization assistant translation-suggestion --source-text "Save changes" --destination-language-code de-DE`.
- "What's our webhook config for localization events?" → `localization config get-webhook`.
