# Contributing to Blocks Packages

Thanks for contributing. This repository is the umbrella npm workspace for the SELISE Blocks
packages. See `README.md` for the package list and the common commands.

## Branch model

- `main`: production-ready code (protected)
- `dev`: integration branch (protected); all pull requests target `dev`
- `inception`: the working branch; day-to-day work happens here

Never commit directly to `dev` or `main`. Work on `inception` and open a pull request from
`inception` into `dev`. Do not force-push and do not rewrite published history.

## Commit conventions

Match the style already in the log. Most commits use Conventional Commits (`type(scope): subject`,
for example `fix(cli): ...`), and a plain imperative subject is also used for straightforward
changes. Keep the subject concise and explain the what and the why in the body when it is not
obvious.

## Reporting a security issue

Do not open a public issue for a suspected vulnerability. Follow the private disclosure process in
[SECURITY.md](SECURITY.md).

## Repository layout

- `blocks-cli/`: the `@seliseblocks/cli-os` package, the terminal and admin control plane.
- `blocks-client/`: the `@seliseblocks/client` package, the framework-neutral frontend SDK.
- `blocks-skills/`: skill definitions consumed by the CLI.
- `scripts/`: local helper scripts, including the security scan entry point.

## Running the tests

Both packages must pass before a pull request can merge. From the repository root:

```bash
npm test          # every package
npm run build     # every package
```

To work on a single package:

```bash
cd blocks-cli && npm test
cd ../blocks-client && npm test
```

## Conventions

- Filenames are kebab-case. Prefer named exports over default exports.
- Types are PascalCase; variables, functions, and parameters are camelCase.
- Public API is consumed by other Blocks repos and by end users, so renames must stay backward
  compatible: keep the old export and mark it `/** @deprecated use <new> */`, never delete it in
  the same release.
- Do not commit credentials or tokens. Read them from the environment at runtime.

## Publishing

Package publishing is a maintainer action tied to a version bump. Do not publish from a feature
branch.
