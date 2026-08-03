# AGENTS.md

## Purpose

This is the AI entry point for the repository.

## Workflow

1. Understand the user's objective.
2. Read `BLOCKS_AGENT_GUIDE.md` before repository work; apply its app-specific sections only when the task involves building or modifying a Blocks application.
3. Use the appropriate skill from `blocks-skills/` when available.
4. Read the relevant package `AI_USAGE_GUIDE.md` when the task touches a package.
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

## Documentation Order

1. `BLOCKS_AGENT_GUIDE.md`
2. `blocks-skills/`
3. `<package>/AI_USAGE_GUIDE.md`
4. Source code

Use the highest-level document that answers the current task. Do not duplicate instructions between documentation layers.
