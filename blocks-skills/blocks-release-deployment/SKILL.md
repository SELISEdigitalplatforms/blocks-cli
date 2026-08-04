---
name: blocks-release-deployment
description: "Trigger and inspect SELISE Blocks Release builds/deploys entirely through `blocks release *` — never raw fetch/curl; there is no SDK path (Release has no `@seliseblocks/client` namespace). Covers `release deploy` (auto-resolves the repo, verifies branch matches environment), `release status`/`builds get` (build lookup by id), and `builds list` (list builds for a repo). Use for 'deploy/trigger a release', 'check build status', 'list recent builds'. Always `--dry-run` before `--yes`. No artifact-upload capability — deploy triggers a configured pipeline only."
---

# Blocks Release — Deployment

Trigger and read Release builds through `blocks release *` — source: `@seliseblocks/cli-os` (this monorepo's `blocks-cli/` package). This is **100% CLI, no SDK equivalent** — `@seliseblocks/client` (`createBlocksClient()`) exposes only `auth`, `data`, `iam`, and `localization`; there is no `release` namespace anywhere in the SDK. Never write a frontend/app-code path for this — it's always a terminal command.

**Prerequisite:** a project is selected (`blocks use <tenantId>`) and that project has a repo linked from the Blocks portal — see **[blocks-onboarding](../blocks-onboarding/SKILL.md)**. There is no local config file for release settings; `blocks init` only scaffolds `blocks/data/schemas/`, `blocks/data/rules.json`, and `.env.example` — it has no release-related output at all. `deploy` and `builds list` both resolve which repo to act on directly from the project's linked assets (see below), not from any file on disk.

## Safe read commands

- **`blocks release status <buildId> [--json]`** — one build's status by id (positional arg, or `--build-id <id>`).
- **`blocks release builds get <buildId> [--json]`** — literally the same call as `release status`; it's a pure alias in the CLI's own source (`releaseBuildsGet` just calls `releaseStatus(argv)`), not a different endpoint or response shape. Use whichever name the user said.
- **`blocks release builds list [<repoId>] [--repo-id <repoId>] [--json]`** — all builds for one repository. `repoId` is optional: if omitted, the CLI auto-resolves it from the selected project's linked repo assets the same way `deploy` does (see "Resolving the repo" below) — **except** when more than one repo is linked, in which case it falls back to an interactive `selectFromList()` prompt instead of erring or guessing. That prompt has no stdin in a non-interactive/agent run and will hang — if you can't guarantee a human is watching the terminal, resolve and pass `--repo-id` explicitly instead of letting this fall through to the prompt (same hang risk `BLOCKS_AGENT_GUIDE.md` already flags for `blocks new web`'s OIDC-client picker).

None of these mutate anything — safe to run without confirmation.

## Mutating: trigger a deploy

```bash
blocks release deploy --dry-run --json   # show the exact request first
blocks release deploy --yes --json       # only after the user approves
```

There is **no `--repo-id` flag on `deploy`** — the repo is always resolved automatically (see below); passing `--repo-id` is not recognized by this command.

### Resolving the repo

`deploy` never takes a repo id as input. It resolves one from the currently selected project's linked assets:

1. It looks up the project's linked repo resources for the project's `tenantGroupId`.
2. If exactly one repo is linked, that's the one used.
3. If multiple are linked, it picks the one whose asset `name` matches the project's `environment` (case-insensitive); if none matches, it throws `repo_ambiguous`.
4. If none are linked at all, it throws `repo_not_linked`.

### Branch/environment safety check

Before building, `deploy` fetches the resolved repo's details (`/release/v4/api/Build/repo-details`) to read its linked branch, then compares that branch to the project's `environment` (case-insensitive). If they don't match, it throws `branch_environment_mismatch` rather than building the wrong branch.

### Error codes you may see

| Code | Meaning | Fix |
|---|---|---|
| `repo_not_linked` | No repo is linked to this project at all. | Link a repo from the Blocks portal (requires GitHub OAuth), then re-run. |
| `repo_ambiguous` | Multiple repos are linked and none is named for the project's `environment`. | Check the repo links for this project from the Blocks portal. |
| `repo_not_found` | The linked asset's repo id wasn't found in blocks-release when fetching repo details. | Check the repo link for this project from the Blocks portal. |
| `branch_environment_mismatch` | The linked repo's branch doesn't match the project's `environment` (e.g. repo is on `main` but environment is `staging`). Message states the branch found and the environment required. | Point the linked repo at a branch named for the environment, or relink the correct branch from the Blocks portal. |
| `build_wait_timeout` | Only with `--wait`: no terminal build status was seen before `--timeout` elapsed. | Check manually with `blocks release status <buildId>`. |

### Optional flags

- **`--domain <domain>`** — before triggering the build, makes an extra call to `/release/v4/api/Build/repo-update` to set a custom deployment domain for this repo/environment.
- **`--wait`** — after triggering, polls `/release/v4/api/Build` (by the returned `buildId`) every `--poll-interval` seconds until the status matches a terminal pattern (succeeded/success/completed/failed/error/cancelled/aborted/done, case-insensitive) or `--timeout` elapses (then throws `build_wait_timeout`).
- **`--poll-interval <seconds>`** — polling interval for `--wait`, default `10`.
- **`--timeout <seconds>`** — max time to wait for `--wait`, default `900`.

`--dry-run` prints the resolved `repoId`, `branch`, `environment`, `projectKey`, and (if given) `domain` — it does **not** build a request body from any local file, since none exists. The real request sent to `/release/v4/api/Build/manual` when not a dry run is simply `{ repoId }`. Always show the `--dry-run` output and get explicit approval before re-running with `--yes` — never skip straight to `--yes`.

## Gotchas

- **No SDK path, ever.** If asked "how do I trigger a deploy from my app," the answer is: you don't — this is a CLI-only, human/CI-operated action, not something to wire into frontend code.
- **No artifact upload.** `release deploy` triggers a *configured* pipeline/repository build — it does not accept or upload a build artifact you hand it. If a user asks to "upload my build and deploy it," that capability doesn't exist in this CLI; say so rather than inventing an upload flag.
- **`release builds get` and `release status` are the same command.** Don't treat them as returning different data or document them separately — the CLI's own source has `builds get` call `release status` directly.
- **Release commands are project-scoped, not account-level.** Every `blocksRequest` call in `deploy`, `status`, and `builds list` passes `impersonatedProjectAuth: true`, and `deploy`/`builds list` both resolve `tenantId`/`tenantGroupId` from `resolveSelectedProject(flags)` — i.e. whichever project is currently selected via `blocks use`. Behavior changes if the selected project changes; there is no account-level/project-independent mode here.
- **`deploy` never takes a repo id from the user** — it's always auto-resolved from the project's linked assets, with a real branch/environment safety check before it will build. Don't offer or accept a `--repo-id` flag on `deploy`.
- **`builds list --repo-id` is optional, not required** — it falls back to the same auto-resolve logic as `deploy`, but that fallback can hit an interactive prompt if multiple repos are linked. Pass `--repo-id` explicitly in any non-interactive/agent context to avoid the hang.
- **`buildId` for `status`/`builds get` is always required**, never guessed — ask the user rather than assuming a value.
- **`--dry-run` before `--yes`, always** — same discipline as every other mutating `blocks` command in this pack.

## Example trigger prompts

- "Deploy this project's configured release."
- "Trigger a build for the linked repo."
- "Check the status of build `<buildId>`."
- "Did my last deploy finish? Look up build `<buildId>`."
- "List the recent builds for this repo."
- "Deploy and wait until it finishes." → add `--wait` (optionally `--poll-interval`/`--timeout`).
- "Deploy this to a custom domain." → add `--domain <domain>`.
- "Can you upload my compiled artifact and deploy it?" → not supported; explain there's no artifact-upload path, only triggering the repo's configured pipeline.
