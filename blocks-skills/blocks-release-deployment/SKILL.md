---
name: blocks-release-deployment
description: "Trigger and inspect SELISE Blocks Release builds/deploys entirely through `blocks-os release *` — never raw fetch/curl, and there is no SDK path for this (Release has no `@seliseblocks/client` namespace at all). Covers `release deploy --repo-id <repoId>` (trigger a manual build for a configured repository, merging in `blocks/release/deploy.json`), `release status <buildId>` / `release builds get <buildId>` (identical read-only build-status lookup — the second is a plain alias of the first), and `release builds list --repo-id <repoId>` (list builds for a repository). Use whenever the user wants to: deploy/redeploy/trigger a release, check a build's status, look up a build by id, or list recent builds for a repo — 'deploy this to the repo', 'trigger a release build', 'check if my build finished', 'what's the status of build X', 'list the last few builds'. Always show `--dry-run` output before running `--yes`. Explicitly has no artifact-upload capability — deploy triggers a configured pipeline, it does not ship a build artifact you hand it."
---

# Blocks Release — Deployment

Trigger and read Release builds through `blocks-os release *` — source: `@seliseblocks/cli-os`, `K:\BLOCKS REPO\Blocks\blocks-packages\blocks-cli-os`. This is **100% CLI, no SDK equivalent** — `@seliseblocks/client` (`createBlocksClient()`) exposes only `auth`, `data`, `iam`, and `localization`; there is no `release` namespace anywhere in the SDK. Never write a frontend/app-code path for this — it's always a terminal command.

**Prerequisite:** a project is selected (`blocks-os use <tenantId>`) and `blocks-os init` has been run — see **[blocks-onboarding](../blocks-onboarding/SKILL.md)**. `init` creates `blocks/release/deploy.json` with `{ "target": "", "strategy": "configured-pipeline" }`; this skill assumes that file exists (even if still at its default placeholder values).

## Safe read commands

- **`blocks-os release status <buildId> [--json]`** — one build's status by id (positional arg, or `--build-id <id>`).
- **`blocks-os release builds get <buildId> [--json]`** — literally the same call as `release status`; it's a pure alias in the CLI's own source, not a different endpoint or response shape. Use whichever name the user said.
- **`blocks-os release builds list --repo-id <repoId> [--json]`** — all builds for one repository (positional arg or `--repo-id`, required — the CLI throws if it's missing, there's no default to guess from).

None of these mutate anything — safe to run without confirmation.

## Mutating: trigger a deploy

```bash
blocks-os release deploy --repo-id <repoId> --dry-run --json   # show the exact request first
blocks-os release deploy --repo-id <repoId> --yes --json       # only after the user approves
```

`--repo-id` can also come from `blocks/release/deploy.json` (its `repoId` field) instead of the flag — the flag wins if both are set, and the command fails with a clear error if neither is present. `--dry-run` prints the exact endpoint (`/release/v4/api/Build/manual`) and the exact request body it would send, which is **the entire contents of `blocks/release/deploy.json` merged with `repoId`** — so review that file's `target`/`strategy` fields (and any other fields the user has added to it) as part of the dry-run review, not just the `--repo-id` value. Always show the `--dry-run` output and get explicit approval before re-running with `--yes` — never skip straight to `--yes`.

## Gotchas

- **No SDK path, ever.** If asked "how do I trigger a deploy from my app," the answer is: you don't — this is a CLI-only, human/CI-operated action, not something to wire into frontend code.
- **No artifact upload.** `release deploy` triggers a *configured* pipeline/repository build — it does not accept or upload a build artifact you hand it. If a user asks to "upload my build and deploy it," that capability doesn't exist in this CLI; say so rather than inventing an upload flag.
- **`release builds get` and `release status` are the same command.** Don't treat them as returning different data or document them separately — the CLI's own source has `builds get` call `release status` directly.
- **Release uses the account-level token, not a project-impersonated one.** Unlike Data/Localization commands (which impersonate into the selected project), all four Release commands authenticate with `accountAuth` — the root account session from `blocks-os login`. This is why Release commands work the same regardless of which project is currently selected via `blocks-os use`; `--repo-id` is what actually scopes the call, not the selected project.
- **`--repo-id`/`buildId` are required, never guessed.** If missing and not resolvable from `blocks/release/deploy.json`, ask the user rather than assuming a value.
- **`--dry-run` before `--yes`, always** — same discipline as every other mutating `blocks-os` command in this pack.

## Example trigger prompts

- "Deploy this repo's configured release."
- "Trigger a build for repo `<repoId>`."
- "Check the status of build `<buildId>`."
- "Did my last deploy finish? Look up build `<buildId>`."
- "List the recent builds for this repo."
- "Can you upload my compiled artifact and deploy it?" → not supported; explain there's no artifact-upload path, only triggering the repo's configured pipeline.
