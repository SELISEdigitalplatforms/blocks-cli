# AGENTS.md

## Purpose

This is the AI entry point for the repository.

## Workflow

1. Understand the user's objective.
2. If the task involves building or modifying a Blocks application (not this monorepo's own source), use the installed `blocks` CLI and package guides from the consumer app context. If project/login state is unknown, start with `docs/AI_ROUTING_GUIDE.md`.
3. If the starting point is unclear, read `docs/AI_ROUTING_GUIDE.md` before choosing a package guide or source path.
4. Read the relevant package `AGENT_GUIDE.md` when the task touches a package's own behavior in depth.
5. Inspect the existing implementation before making changes.
6. Make the smallest correct change.
7. Verify the result before finishing.

## Rules

* Reuse existing architecture, packages, and patterns.
* Do not duplicate business logic.
* Respect package boundaries.
* Use the CLI or SDK instead of reimplementing functionality.
* Create Blocks projects only through `blocks projects create` (single `dev` environment, after the user agrees - it accepts the Blocks terms on their behalf), never through raw project APIs. Adding environments to an existing project is portal-only.
* Never expose secrets or credentials.
* Ask for approval before destructive or cloud-mutating operations.
* Verify changes before considering the task complete.

## Working on Blocks apps vs. working on this monorepo

Two different jobs land here, and the rules below apply only to the second one:

- **Building/modifying a Blocks application** (the common case for an external user): treat this monorepo as a black box - work entirely through the installed `blocks` CLI and `@seliseblocks/client` package. Do not read this repo's `blocks-cli`/`blocks-client` source to figure out package behavior; use `blocks --help`, `blocks doctor --json`, and each package's own `AGENT_GUIDE.md` instead - a real consumer only ever has the installed packages, never this source tree.
- **Maintaining, publishing, or debugging the `blocks-cli`/`blocks-client` packages themselves**: this exception doesn't apply - read the source normally, that's the task.

## Monorepo-only meta-rules (apply regardless of which job above)

* Never open, read, print, or otherwise expose the CLI's local storage files (its config/token/secret files on disk, wherever `blocks doctor --json` says they live) or anything inside them - client ids, root tenant id, account names, tokens. Only ever interact with them through `blocks` commands.

## Documentation Order

1. `docs/AI_ROUTING_GUIDE.md` - the routing guide when the agent can start from any state.
2. `<package>/AGENT_GUIDE.md` - exact flags, defaults, and failure codes for one package.
3. Source code - only when maintaining the CLI/SDK packages themselves (see above).

Use the highest-level document that answers the current task. Do not duplicate instructions between documentation layers.
