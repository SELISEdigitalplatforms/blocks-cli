# Contributing to Blocks Packages

Thanks for contributing. This guide covers the day-to-day workflow for this repository. See `README.md` for package setup.

## Branch model

- `main`: production-ready code (protected)
- `dev`: integration branch (protected); all pull requests target `dev`
- `inception`: the working branch; day-to-day work happens here

Never commit directly to `dev` or `main`. Work on `inception` and open a pull request from `inception` into `dev`. Do not force-push and do not rewrite published history.

## Commit conventions

Match the style already in the log. Most commits use Conventional Commits (`type(scope): subject`, for example `test(cli): ...`, `fix(client): ...`, `chore(skills): ...`); a plain imperative subject is also used for straightforward changes. Keep the subject concise and explain the what and the why in the body when it is not obvious.

## Reporting a security issue

Do not open a public issue for a suspected vulnerability. Follow the private disclosure process in [SECURITY.md](SECURITY.md).

## Repository layout

- `blocks-cli/`: `@seliseblocks/cli-os`, the terminal/admin/AI control plane package.
- `blocks-client/`: `@seliseblocks/client`, the framework-neutral frontend TypeScript SDK package.
- `blocks-skills/`: bundled AI workflow skills exposed through `blocks skill list`, `blocks skill show`, and `blocks skill add`.
- `AI_START_GUIDE.md`: first-stop routing guide for AI agents entering the Blocks workflow.

## Running the checks

Install workspace dependencies from the repository root:

```bash
npm install
```

Run all package tests:

```bash
npm test
```

Build all packages:

```bash
npm run build
```

Work on a single package:

```bash
cd blocks-cli
npm test

cd ../blocks-client
npm test
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Package publishing checks

Before publishing either package, run the package-local test and pack dry run:

```bash
cd blocks-cli
npm test
npm pack --dry-run

cd ../blocks-client
npm test
npm pack --dry-run
```

Review the dry-run file list before publishing. The public package must not include secrets, local auth state, unpublished credentials, or generated files outside the package's intended `files` list.

## AI workflow docs

AI agents should start with [AI_START_GUIDE.md](AI_START_GUIDE.md). For package-specific behavior, use:

- `blocks-cli/AI_USAGE_GUIDE.md` for CLI command contracts, flags, and failure behavior.
- `blocks-client/AI_USAGE_GUIDE.md` for SDK usage rules and method boundaries.
- `blocks skill list` and `blocks skill show <name>` for consumer Blocks app workflows.

Do not inspect or expose local CLI storage files. Use `blocks doctor --json`, `blocks auth status --json`, and other supported `blocks` commands instead.

## Backward compatibility

The CLI, SDK, and bundled skill workflows are consumed by external users and AI agents. When changing public behavior:

- Keep existing exported SDK names working where practical and mark renamed exports with `@deprecated`.
- Keep CLI command aliases, flags, JSON shapes, and documented failure codes stable unless a breaking change is intentional and documented.
- Keep skill names and high-level workflow handoffs stable when possible.
- Update `README.md`, `AI_START_GUIDE.md`, package `AI_USAGE_GUIDE.md` files, and tests with behavioral changes.
