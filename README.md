# SELISE Blocks Packages

This repository contains the public npm packages and AI workflow assets for building with SELISE Blocks.

SELISE Blocks provides a CLI for project setup and administration, a framework-neutral frontend SDK for runtime application code, and bundled AI skills that guide agents through supported Blocks workflows.

## Packages

| Package | npm | Source | Purpose |
|---|---|---|---|
| `@seliseblocks/cli-os` | [npm](https://www.npmjs.com/package/@seliseblocks/cli-os) | [`blocks-cli`](blocks-cli/README.md) | Terminal/admin/AI control plane for auth, projects, scaffolding, Data configuration, Release operations, IAM, MFA, Auth, Mail, Notification, Storage, and bundled skills. |
| `@seliseblocks/client` | [npm](https://www.npmjs.com/package/@seliseblocks/client) | [`blocks-client`](blocks-client/README.md) | Framework-neutral TypeScript SDK for frontend/runtime access to Auth, IAM, Data, Localization, Mail, MFA, and Notifier APIs. |

## Repository Structure

```text
.
|-- blocks-cli/          # @seliseblocks/cli-os source, README, AI usage guide, tests
|-- blocks-client/       # @seliseblocks/client source, README, AI usage guide, tests
|-- blocks-skills/       # Bundled AI workflow skills copied into the CLI package build
|-- docs/                # Cross-package documentation, including the AI start guide
|-- AGENTS.md            # Repository instructions for AI coding agents
|-- CONTRIBUTING.md      # Contribution workflow
|-- CODE_OF_CONDUCT.md   # Community standards
|-- SECURITY.md          # Private vulnerability disclosure policy
`-- LICENSE              # MIT license
```

## Installation

Install the CLI globally when you want to operate Blocks from a terminal or automation environment:

```bash
npm install -g @seliseblocks/cli-os@latest
blocks --version
```

Install the SDK inside a frontend application:

```bash
npm install @seliseblocks/client@latest
```

Both packages require Node.js 20 or newer.

## CLI Quick Start

```bash
blocks --help
blocks login
blocks auth status --json
blocks doctor --json
blocks skill list
```

The CLI uses supported Blocks APIs and stores local auth state through OS-aware credential storage. Do not inspect local token/config files directly; use `blocks auth status` and `blocks doctor` for diagnostics.

See [`blocks-cli/README.md`](blocks-cli/README.md) for the full command overview.

## SDK Quick Start

```ts
import { createBlocksClient } from "@seliseblocks/client";

const blocks = createBlocksClient({
  apiUrl: "https://api.seliseblocks.com",
  xBlocksKey: "<blocks-key>",
  accessToken: () => currentUserSession?.accessToken,
  oidc: {
    url: "https://iam.seliseblocks.com",
    clientId: "<public-browser-client-id>",
    redirectUri: `${window.location.origin}/login/callback`
  }
});
```

See [`blocks-client/README.md`](blocks-client/README.md) for SDK setup and runtime examples.

## AI Agent Usage

AI agents should start with [`docs/AI_START_GUIDE.md`](docs/AI_START_GUIDE.md). It routes agents based on whether they are onboarding, building a Blocks app, operating the CLI, using the SDK, or maintaining this monorepo.

Use these package-specific guides for exact contracts:

- [`blocks-cli/AI_USAGE_GUIDE.md`](blocks-cli/AI_USAGE_GUIDE.md)
- [`blocks-client/AI_USAGE_GUIDE.md`](blocks-client/AI_USAGE_GUIDE.md)

Bundled workflow skills are available through the CLI:

```bash
blocks skill list
blocks skill show blocks-onboarding
blocks skill add blocks-onboarding
```

## Development

Install workspace dependencies from the repository root:

```bash
npm install
```

Build all packages:

```bash
npm run build
```

Run all package tests:

```bash
npm test
```

Work on a single package:

```bash
cd blocks-cli
npm test

cd ../blocks-client
npm test
```

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`.

## Publishing Checks

Before publishing a package, run its local test suite and verify the tarball contents:

```bash
cd blocks-cli
npm test
npm pack --dry-run

cd ../blocks-client
npm test
npm pack --dry-run
```

Both packages are configured for public npm publishing through `publishConfig.access = "public"`.

## Community And Security

GitHub displays these root-level files automatically in the repository UI:

- [Contributing](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [License](LICENSE)

Please report suspected vulnerabilities privately through the process in [SECURITY.md](SECURITY.md).
