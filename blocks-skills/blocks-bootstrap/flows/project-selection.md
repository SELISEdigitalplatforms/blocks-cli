# Flow: Getting to a selected project

Three ways in, one exit: a project is selected and verified. Pick the branch that matches what the user already gave you — do not walk them through the others.

Everything below needs a usable account or project token pair for the resolved
account. Missing account tokens are normal while a valid project pair exists.
If all tokens are missing, return to the bootstrap skill: log in explicitly for
local use, or require launcher bootstrap for Code Studio.

## Branch A — the user supplied an x-blocks-key

The common case when someone arrives with a key from the portal, a colleague, or a link. **Use it directly.** Do not list projects, and do not ask them to confirm a choice they already made.

```bash
blocks use <x-blocks-key>
blocks projects get --json
```

`projects get` is the verification step, not decoration: it proves the key resolves to a project this account can actually reach, and returns the name, environment, and application domains you will need later. If it fails, say so plainly and fall back to Branch B rather than guessing at a corrected key.

Then continue to the inventory flow if the user asked what is already there.

## Branch B — no key, and the account has projects

```bash
blocks projects list --json
```

Show the user **every** project they can reach, and say which one is currently selected if any. Never silently continue on a prior session's cached selection — it is local state that may be stale, or may belong to work they finished last week.

Ask which project and which environment they want. Never guess when more than one could plausibly fit, and never pick "the only one that looks like the app they described". Then:

```bash
blocks use <x-blocks-key>
blocks projects get --json
```

For a single one-off command against a different project, `--project <tenantId>` avoids changing the user's selection at all. Prefer it over `use` when you only need one read.

## Branch C — the account has no projects yet

First find out whether this CLI build can create one. Older builds cannot, and the command surface is the only reliable signal:

```bash
blocks projects create "<name>" --dry-run --json
```

**If it prints a dry-run request body**, creation is supported. Show that body to the user and explain what they are agreeing to before running it for real — this command accepts the Blocks terms on their behalf (`isAcceptBlocksTerms`, `isUseBlocksExclusively`), which is why it confirms rather than running silently:

```bash
blocks projects list --json
blocks projects create "<name>" --yes --json
blocks use <tenantId>
```

`--dry-run` returns before the duplicate-name check, so a dry run never tells you the name is taken. The real run does: it refuses with `project_name_taken` if any project on the account already uses that name, and only `--allow-duplicate-name` overrides that. Names must be 3–100 characters.

What it creates is deliberately narrow (see `blocks help projects create` for the exact shape — dev-only environment, placeholder domain, session handling). Provisioning is asynchronous, so the command polls briefly and reports whether the new project has been published yet; read the real domain back from the result rather than from the request. The new project is not selected automatically.

**If it fails with `{"code": "command_failed", "message": "Unknown command: projects create"}`**, this build cannot create projects. Check whether that is fixable before sending the user elsewhere:

```bash
blocks --version
npm view @seliseblocks/cli-os version
```

If the installed version is behind, offer the upgrade (`npm install -g @seliseblocks/cli-os@latest`) and ask before running it. If they decline, or the published version has no create command either, the project must be created from the Blocks portal at `https://os.seliseblocks.com`. Give them the link, wait for them to confirm it exists, then re-run `blocks projects list --json` and continue from Branch B.

## Recovering a stuck selection

Project tokens are created lazily from the account session the first time a project-scoped command needs one. Never ask the user for a project token directly — there is nothing for them to paste.

If an impersonated project token gets stuck, rejected, or expired and `blocks auth refresh --project --json` does not clear it:

```bash
blocks deselect
blocks use <x-blocks-key>
```

`deselect` exchanges the project pair for a fresh account pair and clears the
account-specific selection; reselecting exchanges back to a fresh project pair.

One failure that looks like this but is not: `impersonation_invalid_client` means the CLI client id printed in the error is not registered for project impersonation. Give that id to an admin. Re-login, re-selection, and `auth config` cannot repair it.

## Done when

- `blocks projects get --json` returns the project the user actually intended.
- The user has seen its name, environment, and domain, and agreed it is the right one.
- You have not written a project key, domain, or client id into any file from memory — every value came from a command's output.
