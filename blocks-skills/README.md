# The skills moved

The SELISE Blocks agent skills now live in
**[SELISEdigitalplatforms/blocks-skills](https://github.com/SELISEdigitalplatforms/blocks-skills)**,
under [`skills/`](https://github.com/SELISEdigitalplatforms/blocks-skills/tree/main/skills),
with their full history. Edit, add, and review skills there.

- **Install them:** see that repo's README — a plugin for Claude Code and Cursor, or the
  `BOOTSTRAP.md` vendoring runbook for every other agent.
- **Changing a CLI command a skill cites?** Open the matching PR in `blocks-skills`.
  Nothing in this repo checks skills any more; that repo's CI lints them against the
  published CLI.
- **Last version here:** tag `skills-last-in-cli`. Repos vendored before the move are
  stamped with a commit from this repo; the bootstrap runbook in `blocks-skills` still
  reads it, so don't rewrite this repo's history.

This folder is a signpost and will be removed in a later release.
