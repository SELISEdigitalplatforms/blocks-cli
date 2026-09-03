---
name: blocks-release-deployment
description: "Trigger and inspect SELISE Blocks Release builds/deploys entirely through `blocks release *` — never raw fetch/curl; there is no SDK path. Covers `deploy` (re-deploy), `setup` (first deploy), `status`/`logs` (by build id), `repos list`/`builds list` (inventory), `secrets sync` (env vars from a dotenv file), `reports get` (SAST/SCA), and `teardown` (destructive). Use for 'deploy a release', 'check build status', 'stream build logs', 'sync env vars', 'list builds'. Always `--dry-run` before `--yes`. No artifact upload — deploy triggers a configured pipeline only."
---

When invoking a project-scoped `blocks` command, either use the resolved account's saved selection or pass `--project <tenantId>` for that one command without changing saved state. `--project` applies to CLI commands only, never SDK calls.

# Blocks Release — Deployment

Trigger and read Release builds through `blocks release *`. This is **100% CLI,
no SDK equivalent**: `@seliseblocks/client` has no `release` namespace. Never
write a frontend/app-code path for this; use the terminal command.

**Prerequisite:** a project is selected (`blocks use <tenantId>`) and that project has a repo linked from the Blocks portal — see the blocks-bootstrap skill. There is no local config file for release settings; `blocks init` only scaffolds `blocks/data/schemas/`, `blocks/data/rules.json`, and `.env.example` — it has no release-related output at all. Release commands resolve which repo to act on from the project's registered repos (see below), not from any file on disk.

## Safe read commands

- **`blocks release repos list [--json]`** — the repositories registered in blocks-release for this project: `repoId`, `name`, `branch`, `lastDeploymentStatus`, `url`, `namespace`. Run this first when you need a repo id or name.
- **`blocks release repo get <repo> [--json]`** — one repo's details plus its most recent builds; `<repo>` is a name or id.
- **`blocks release status <buildId> [--wait] [--follow] [--json]`** — one build's status by id (positional arg, or `--build-id <id>`), plus a stable `verdict` field: `succeeded`, `failed`, or `running`, derived from the build's status field. `--wait` polls until terminal; `--follow` also streams pipeline events to stderr. In `--json` mode stdout is always exactly one document.
- **`blocks release logs <buildId> [--follow] [--group Clone|Build|Deploy|Sast|Sca] [--json]`** — the build's stored pipeline events; `--follow` keeps streaming new events until the build is terminal.
- **`blocks release builds list [<repo>] [--branch <b>] [--page <n>] [--page-size <n>] [--json]`** — paged builds for one repository, addressed by name or id. When the selector is omitted and exactly one repo is registered, it's auto-picked; with multiple repos it fails with `repo_ambiguous` listing the candidates — it never prompts interactively, so it is safe in agent/CI runs.
- **`blocks release settings list [--json]`** — the hosting choices `release setup` accepts (provider → region → machine spec, each with id and name).
- **`blocks release git repos [--provider github] [--search <s>] [--json]`** / **`blocks release git branches <owner/repo> [--json]`** — browse the connected source-control account. Only `github` is active; other providers fail with `provider_not_supported`.
- **`blocks release reports get <buildId> --type sast|sca-container|sca-libraries|dast [--json]`** — the build's SonarQube (SAST), Dependency-Track (SCA, split into the container-image scan and the library-manifest scan), or DAST report. These are the server's exact type names; a plain `sca` is rejected with `invalid_report_type`.
- **`blocks release monitor list [--repo <name|id>] [--json]`** — monitoring/alerting entries for a deployed repo.
- **`blocks release secrets list [--repo <name|id>] [--json]`** / **`secrets audit`** — secret-set metadata and audit trail; neither ever returns key names or values.

None of these mutate anything — safe to run without confirmation.

## Mutating: trigger a deploy

```bash
blocks release deploy --dry-run --json   # show the exact plan first
blocks release deploy --yes --json       # only after the user approves
```

`deploy` re-deploys an already-configured repo (`Build/manual`). For a repo that has never been deployed, use `blocks release setup` instead (`Build/run-build` — it creates the deployment namespace and push webhook, and takes optional `--hosting-provider`/`--region`/`--machine-config`, each a name or id from `release settings list`).

### Resolving the repo

`deploy` resolves the repo in this order:

1. `--repo <name|id>` — matched against the project's registered repos (`release repos list`); ambiguous or unknown selectors throw `repo_ambiguous`/`repo_not_found` with the candidates listed.
2. No flag: the project's linked repo assets — the single linked repo, or with multiple, the one whose asset `name` matches the project's `environment` (case-insensitive); if none matches, it throws `repo_ambiguous`.
3. If none are linked at all, it throws `repo_not_linked`.

### Branch/environment safety check

Before building, `deploy` (and `setup`) compares the resolved repo's linked branch to the project's `environment` (case-insensitive). If they don't match, it throws `branch_environment_mismatch` rather than building the wrong branch.

### Error codes you may see

| Code | Meaning | Fix |
|---|---|---|
| `repo_not_linked` | No repo is linked/registered for this project at all. | Link a repo from the Blocks portal (requires GitHub OAuth), then re-run. |
| `repo_ambiguous` | Multiple repos and no unambiguous selector. The message lists the candidates. | Pass `--repo <name|id>` (or the exact id if two share a name). |
| `repo_not_found` | The selector or linked asset id wasn't found in blocks-release. | Run `blocks release repos list` and use a listed name or id. |
| `branch_environment_mismatch` | The repo's branch doesn't match the project's `environment` (e.g. repo is on `main` but environment is `staging`). | Point the linked repo at a branch named for the environment, or relink the correct branch from the Blocks portal. |
| `build_wait_timeout` | Only with `--wait`/`--follow`: no terminal status before `--timeout` elapsed. | Check with `blocks release status <buildId>` or keep watching with `--wait`. |
| `provider_not_supported` | A `--provider` other than `github` on the `git` commands. | Only GitHub is active in blocks-release today. |

### Optional flags on `deploy`

- **`--repo <name|id>`** — pick the repo explicitly instead of auto-resolving.
- **`--with-secrets <dotenvFile>`** — before deploying, runs `release secrets sync` for that file (see below).
- **`--domain <domain>`** — before triggering the build, sets a custom deployment domain for this repo/environment (also available standalone as `release domain set <domain>`).
- **`--wait`** — after triggering, polls the build's status **field** until it reaches one of the server's terminal values (Succeeded/Failed/Cancelled/Timeout/…), then prints one final `{buildId, status, verdict, build}` document.
- **`--follow`** — implies `--wait` and additionally streams pipeline events to stderr while polling.
- **`--poll-interval <seconds>`** — polling interval, default `10`.
- **`--timeout <seconds>`** — max wait, default `900`.

All wait/follow progress goes to **stderr**; stdout stays a single parseable document in `--json` mode. `--dry-run` prints the resolved `repoId`, `branch`, `environment`, `projectKey`, planned `steps`, and (if given) `domain`/`secretsFile`. The real deploy request is simply `{ repoId }`. Always show the `--dry-run` output and get explicit approval before re-running with `--yes` — never skip straight to `--yes`.

## Mutating: sync env vars

```bash
blocks release secrets sync --file .env --dry-run --json   # plan: key NAMES only
blocks release secrets sync --file .env --yes --json
```

The server stores **one whole secret set per repo**. Sync merges the dotenv file over the current set by default (an audited read backs the diff; if that read fails for any reason other than "no set yet", sync stops with `secrets_read_failed` and saves nothing) and **never removes keys** unless `--prune` is passed, which makes the file the entire set and lists the removed key names in the plan. Values are never displayed by any output, dry-run included. A no-change run reports `upToDate` without writing. Related lifecycle commands: `secrets lock|unlock|delete|restore` act on the whole set; `delete` is soft and `restore` undoes it.

## Destructive: teardown

`blocks release teardown <repo>` cancels in-flight builds and **deletes the Kubernetes namespace** of that repo's deployment. It requires the repo named explicitly (name or id) — there is deliberately no "the only repo" fallback — and its confirmation states the namespace and served URL being destroyed. Not undoable. Always `--dry-run` first and get explicit user approval; never run it with `--yes` on your own judgment.

## Gotchas

- **No SDK path, ever.** If asked "how do I trigger a deploy from my app," the answer is: you don't — this is a CLI-only, human/CI-operated action, not something to wire into frontend code.
- **No artifact upload.** `release deploy` triggers a *configured* pipeline/repository build — it does not accept or upload a build artifact you hand it. If a user asks to "upload my build and deploy it," that capability doesn't exist in this CLI; say so rather than inventing an upload flag.
- **Release commands are project-scoped, not account-level.** They run on an impersonated project token and resolve repos from whichever project is currently selected via `blocks use`. Behavior changes if the selected project changes; there is no account-level/project-independent mode here.
- **Repo selectors accept names or ids** everywhere (`--repo`, positionals). Prefer the id when two repos could share a name.
- **`release setup` vs `release deploy`:** `setup` is the first-time deploy (creates namespace + webhook, takes hosting settings); `deploy` re-deploys with the stored settings. Running `setup` twice risks duplicate webhooks — if unsure whether a repo was deployed before, check `release repos list` for a `namespace`/`lastDeploymentStatus` first.
- **`buildId` for `status`/`logs`/`reports get` is always required**, never guessed — ask the user rather than assuming a value.
- **`--dry-run` before `--yes`, always** — same discipline as every other mutating `blocks` command in this pack.

## Example trigger prompts

- "Deploy this project's configured release."
- "Trigger a build for the linked repo."
- "Deploy repo X for the first time." → `release setup X` (after `release settings list` if hosting flags are wanted).
- "Check the status of build `<buildId>`."
- "Show me the logs of build `<buildId>`." → `release logs <buildId>` (add `--follow` while it's running).
- "Did my last deploy finish? Look up build `<buildId>`."
- "List the recent builds for this repo."
- "Upload/sync my .env to the deployment." → `release secrets sync --file .env` (dry-run first).
- "Deploy and wait until it finishes." → add `--wait` (or `--follow` for live events; optionally `--poll-interval`/`--timeout`).
- "Deploy this to a custom domain." → add `--domain <domain>` (or `release domain set <domain>`).
- "What did the security scan find?" → `release reports get <buildId> --type sast` (and `--type sca-libraries` / `--type sca-container`).
- "Delete the deployment of repo X." → `release teardown X`, dry-run + explicit approval first.
- "Can you upload my compiled artifact and deploy it?" → not supported; explain there's no artifact-upload path, only triggering the repo's configured pipeline.
