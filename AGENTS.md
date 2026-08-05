# AGENTS.md

## Purpose

This is the AI entry point for the repository.

## Workflow

1. Understand the user's objective.
2. If the task involves building or modifying a Blocks application (not this monorepo's own source), run `blocks skill list` and pull the relevant skill(s) with `blocks skill show <name>` / `blocks skill add <name>` - start with `blocks-onboarding` if project/login state is unknown. Skills are the ground truth for CLI/SDK usage; don't duplicate that flow here.
3. If the starting point is unclear, read `AI_START_GUIDE.md` before choosing a package guide or skill.
4. Read the relevant package `AI_USAGE_GUIDE.md` when the task touches a package's own behavior in depth.
5. Inspect the existing implementation before making changes.
6. Make the smallest correct change.
7. Verify the result before finishing.

## Rules

* Reuse existing architecture, packages, and patterns.
* Do not duplicate business logic.
* Respect package boundaries.
* Use the CLI or SDK instead of reimplementing functionality.
* Never expose secrets or credentials.
* Ask for approval before destructive or cloud-mutating operations.
* Verify changes before considering the task complete.

## Working on Blocks apps vs. working on this monorepo

Two different jobs land here, and the rules below apply only to the second one:

- **Building/modifying a Blocks application** (the common case for an external user): treat this monorepo as a black box - work entirely through the installed `blocks` CLI and `@seliseblocks/client` SDK, guided by `blocks-skills/`. Do not read this repo's `blocks-cli`/`blocks-client` source to figure out CLI/SDK behavior; use `blocks --help`, `blocks doctor --json`, and each package's own `AI_USAGE_GUIDE.md` instead - a real consumer only ever has the installed packages, never this source tree.
- **Maintaining, publishing, or debugging the `blocks-cli`/`blocks-client` packages themselves**: this exception doesn't apply - read the source normally, that's the task.

## Monorepo-only meta-rules (apply regardless of which job above)

* Never open, read, print, or otherwise expose the CLI's local storage files (its config/token/secret files on disk, wherever `blocks doctor --json` says they live) or anything inside them - client ids, root tenant id, account names, tokens. Only ever interact with them through `blocks` commands.
* After the workspace is confirmed, create or update `blocks-session-log.md` outside the generated project folder, and update it throughout the workflow with goal, cwd, phase, command, key output, decision, and next step; if file writing is unavailable, keep the same log in chat as `Session log`.

## Documentation Order

1. `AI_START_GUIDE.md` - the routing guide when the agent can start from any state.
2. `blocks-skills/` (via `blocks skill list`/`show`/`add`) - the ground truth for CLI/SDK usage flow.
3. `<package>/AI_USAGE_GUIDE.md` - exact flags, defaults, and failure codes for one package.
4. Source code - only when maintaining the CLI/SDK packages themselves (see above).

Use the highest-level document that answers the current task. Do not duplicate instructions between documentation layers - if a skill and a package guide would say the same thing, the skill owns the conversational flow and the package guide owns the exact command contract; don't repeat one inside the other.
