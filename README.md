# Blocks Packages

Umbrella workspace for SELISE Blocks npm packages.

## Packages

| Folder | Package | Purpose |
|---|---|---|
| `blocks-cli` | `@seliseblocks/cli-os` | Terminal/admin/AI control plane for auth, projects, scaffolding, Data config, Release operations, and IAM/MFA/Auth/Mail/Notification/Storage admin. |
| `blocks-client` | `@seliseblocks/client` | Framework-neutral frontend TypeScript SDK for auth, current user, Data runtime access, Localization, and shared HTTP/config. |

## Commands

For AI agents that need to enter the workflow from any state, start with [AI_START_GUIDE.md](AI_START_GUIDE.md).

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
