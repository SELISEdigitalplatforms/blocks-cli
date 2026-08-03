---
name: blocks-localization-implementation
description: "Consume SELISE Blocks localization at runtime in a scaffolded frontend, entirely through the `@seliseblocks/client` SDK's `localization` namespace — never raw fetch/curl against `/localization/v4/*`. Use whenever a user wants to make a Blocks web app multilingual on the client: list supported languages for a picker (`languages()`/`languagesForCurrentTenant()`), discover translation modules (`modules()`/`modulesForCurrentTenant()`), load one or many dictionaries at startup (`translations()`, `cloudTranslations()`, `load()`, `loadCloud()`), look up specific key metadata (`keysByNames()`), render labels with the built-in `t()` lookup, or wire a language switcher that reloads dictionaries and re-renders. This is the frontend consumption side only — authoring/pushing the actual translation content and modules is owned by the sibling skill blocks-localization-configuration; don't duplicate its CLI commands here."
---

# Blocks Localization — Implementation (frontend)

Make a scaffolded Blocks web app render its UI in the user's language, using only the `localization` namespace on the SDK client — `createBlocksClient(...).localization`. No fetch, no manual query strings, no hand-rolled caching: the SDK client already does all of that.

The translations themselves (keys, modules, per-language values) are authored and pushed with **[blocks-localization-configuration](../blocks-localization-configuration/SKILL.md)** (uses `blocks-os localization:*`). This skill only covers loading and rendering them in the app.

## The client and its cache

`localization` is a `BlocksLocalizationClient` instance created once inside `createBlocksClient()` (source: `blocks-packages/blocks-client/src/localization/localization-client.ts`). It holds its dictionary cache as instance state — a `Map` keyed by `` `${language}:${moduleName}` `` plus an `activeLanguage`. That cache is **only as shared as the client instance is**: the canonical scaffold creates one `blocksClient` singleton (`src/lib/blocks/client.ts`, from `createBlocksClient()`) and imports it everywhere, so every `t()` call sees every dictionary loaded anywhere in the app. If you instantiate a second `createBlocksClient()` somewhere, it gets its own empty cache — don't do that; import the one singleton.

## Public vs. authenticated methods

Every method has a matching pair — one public, one tenant/session-scoped:

| Public (no token sent) | Authenticated (sends token when configured) |
|---|---|
| `languages()` — `GET /Language/Gets` | `languagesForCurrentTenant()` — `GET /Language/GetLanguagesForCurrentTenant` |
| `modules()` — `GET /Module/Gets` | `modulesForCurrentTenant()` — `GET /Module/GetModulesForCurrentTenant` |
| `translations(moduleName, language)` — `GET /Key/GetUilmFile` | `cloudTranslations(moduleName, language)` — `GET /Key/GetCloudUilmFile` |
| `load(language, modules[])` | `loadCloud(language, modules[])` |

- `languages()`/`modules()`/`translations()`/`load()` are explicitly public — all tenant-supported cultures and translation bundles, usable pre-login for a language picker or startup locale selection.
- `languagesForCurrentTenant()`/`modulesForCurrentTenant()`/`cloudTranslations()`/`loadCloud()` are scoped to whichever tenant the active `x-blocks-key` resolves to (and send the caller's access token if the client is configured with one) — use these for protected, tenant-specific dictionaries behind a signed-in session.

`keysByNames({ keyNames, moduleId? })` — `POST /Key/GetsByKeyNames` — fetches specific key records (metadata/translations) without downloading a whole module dictionary; useful for a one-off label or an admin screen that inspects individual keys.

**Argument order matters**: `translations(moduleName, language)` and `cloudTranslations(moduleName, language)` take module first, language second — easy to transpose.

## Startup sequence

1. **List languages** on app boot (or in a query hook) — `blocksClient.localization.languagesForCurrentTenant()` (or `languages()` if you want it available pre-login). Use `isDefault`/`languageCode` from the result to build the picker and preselect a default, falling back to a persisted user choice (e.g. `localStorage`).
2. **Load dictionaries** for the active language — `blocksClient.localization.load(language, modules)` where `modules` is the list of bundles the app needs (e.g. `["common", "dashboard", "assets"]`). `load()` fetches each module's dictionary in parallel via `translations()` and merges them into one object, with later modules in the array overwriting earlier ones on key collision. Use `loadCloud()` instead for protected dictionaries once the user is signed in.
3. **Render labels** with `blocksClient.localization.t(key, fallback, { language, moduleName })`. It reads from dictionaries already loaded by `translations()`/`load()` (or their cloud equivalents) — it does not fetch anything itself. Missing key → `fallback` → the raw key, in that order.
4. **Switch language**: on switcher change, call `load()` (or `loadCloud()`) again with the new language and the same module list, then re-render. There's no separate "invalidate" step — loading a language populates its own cache entries; you don't need to clear the old language's entries (they just stop being read once `activeLanguage`/your app state moves on).

The canonical scaffold (`blocks-os new web`) wires exactly this pattern in `src/lib/i18n/LocalizationProvider.tsx` (written by `blocks-cli-os`'s `src/lib/scaffold-web/i18n.ts`): a React context holds `language` state (seeded from `localStorage`), a `useEffect` on `language` calls `blocksClient.localization.load(language, MODULES)` and stores the merged dictionary in state, and `t(key, fallback)` reads `cloudDictionary[key] ?? defaultDictionary[key] ?? fallback ?? key` — layering the network dictionary over a build-time `defaultDictionary` (from `src/lib/i18n/dictionary.ts`, generated from the same keys as the seed JSON in `blocks/localization/*.json`) as an offline/first-paint safety net, itself falling back to the caller-supplied fallback and finally the key. Mirror this shape rather than inventing your own provider — it's already generated into new projects. Note the scaffold's own `t()` is a plain function on context, not the SDK's `localization.t()` — either is fine; the SDK's built-in `t()` needs no separate context/provider if you're happy reading `blocksClient.localization.t(...)` directly in components.

## `t()` lookup details worth knowing

- If you pass `moduleName`, `t()` does an exact `` `${language}:${moduleName}` `` cache lookup — deterministic.
- If you omit `moduleName`, `t()` scans all cached dictionaries and returns the first match whose cache key starts with `` `${language}:` `` (or any language if you didn't pass one). Scan order follows Map insertion order, which is the order the underlying HTTP requests *resolved* in (not necessarily the order you listed modules in `load()`) — fine when keys are unique across modules, ambiguous if two modules define the same key. Pass `moduleName` explicitly whenever you know it and key collisions across modules are possible.
- `t()` never throws and never fetches — call `load()`/`translations()` (or the cloud variants) first, or every lookup falls straight to `fallback`/the key.

## Gotchas

- **No raw fetch/curl, ever** — every read here goes through `blocksClient.localization.*`. The SDK already sends `x-blocks-key` and, for the authenticated variants, the caller's access token when configured.
- **One client, one cache** — don't call `createBlocksClient()` more than once in the app; import the scaffold's `blocksClient` singleton everywhere `t()`/`load()` is needed, or dictionaries loaded in one part of the app won't be visible in another.
- **`translations`/`cloudTranslations` take `(moduleName, language)`** — module first.
- **Dictionaries only contain string values** — the SDK strips any non-string fields from the raw response (and unwraps a `data` envelope if present) before caching, so don't expect nested objects in a loaded dictionary.
- **This skill doesn't author content.** Adding a new key/module or changing a translated value goes through `blocks-localization-configuration`'s `blocks-os localization:*` commands, not this skill.

## Example trigger prompts

- "Add a language switcher and translate the UI."
- "Load the `common` and `dashboard` translation modules on app startup and use them to render labels."
- "The Assets page still has hard-coded English strings — replace them with `t()` lookups."
- "Show only the languages this tenant actually has configured, with the default one preselected."
- "I need one specific translated key without pulling down the whole module."
