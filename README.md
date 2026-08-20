# Blocks Packages

Umbrella workspace for SELISE Blocks npm packages and bundled AI workflow skills.

## Packages

| Folder | Package | Purpose |
|---|---|---|
| [`blocks-cli`](blocks-cli/README.md) | `@seliseblocks/cli-os` | Terminal/admin/AI control plane for auth, projects, scaffolding, Data config, Release operations, and IAM/MFA/Auth/Mail/Notification/Storage admin. |
| [`blocks-client`](blocks-client/README.md) | `@seliseblocks/client` | Framework-neutral frontend TypeScript SDK for auth, current user, Data runtime access, Localization, and shared HTTP/config. |
| [`blocks-skills`](blocks-skills/) | Bundled CLI skills | AI workflow instructions exposed through `blocks skill list`, `blocks skill show <name>`, and `blocks skill add <name>`. |

## Install

Install the CLI globally:

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

Install the SDK in a frontend application:

```bash
npm install @seliseblocks/client@latest
```

## AI Usage

For AI agents that need to enter the Blocks workflow from any state, start with [docs/AI_START_GUIDE.md](docs/AI_START_GUIDE.md).

Use package-specific guides for exact command and SDK behavior:

- [blocks-cli/AI_USAGE_GUIDE.md](blocks-cli/AI_USAGE_GUIDE.md)
- [blocks-client/AI_USAGE_GUIDE.md](blocks-client/AI_USAGE_GUIDE.md)

## Development

Install workspace dependencies:

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

## Community And Security

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [License](LICENSE)
