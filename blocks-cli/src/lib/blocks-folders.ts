/**
 * The `blocks/` tree every Blocks app gets, one folder per service.
 *
 * `data/`, `localization/` and `workflows/` are two-way: their commands pull files
 * down and push them back. The other folders are read-only snapshots written by
 * `blocks pull`, so an agent can read the project's IAM, auth, mail, storage,
 * release and logic setup without calling the CLI; changes still go through each
 * service's own commands. `blocks init` and `blocks new web` both write this tree
 * so an app looks the same whichever command created it.
 */

export type SnapshotService = "iam" | "auth" | "mail" | "storage" | "release" | "logic";

export const SNAPSHOT_SERVICES: readonly SnapshotService[] = ["iam", "auth", "mail", "storage", "release", "logic"];

/** Files `blocks pull` writes per service, with the command that changes each one. */
export const SNAPSHOT_FILES: Record<SnapshotService, ReadonlyArray<{ file: string; changeWith: string }>> = {
  iam: [
    { file: "roles.json", changeWith: "blocks iam roles create/update/assign-permissions" },
    { file: "permissions.json", changeWith: "blocks iam permissions create/update" },
    { file: "resource-groups.json", changeWith: "no CLI command (read-only)" },
    { file: "features.json", changeWith: "no CLI command (read-only)" }
  ],
  auth: [
    { file: "config.json", changeWith: "blocks auth config save" },
    { file: "oidc-clients.json", changeWith: "blocks auth oidc-clients save/delete/rotate-secret" },
    { file: "identity-providers.json", changeWith: "blocks auth idp create/update/delete" }
  ],
  mail: [
    { file: "configs.json", changeWith: "blocks mail config save/delete" },
    { file: "templates.json", changeWith: "blocks mail template save/clone/delete" }
  ],
  storage: [
    { file: "configs.json", changeWith: "blocks storage config save/delete" }
  ],
  release: [
    { file: "repos.json", changeWith: "blocks release setup/deploy/teardown" }
  ],
  logic: [
    { file: "proxies.json", changeWith: "blocks logic proxy create/update/delete" },
    { file: "schedules.json", changeWith: "blocks logic scheduler create/update/delete" }
  ]
};

const SNAPSHOT_TITLES: Record<SnapshotService, string> = {
  iam: "IAM: roles, permissions, resource groups and features",
  auth: "Auth: login config, OIDC clients and identity providers",
  mail: "Mail: mail server configs and templates",
  storage: "Storage: storage provider configs",
  release: "Release: repos registered for deployment",
  logic: "Logic: proxies and schedules"
};

function snapshotReadme(service: SnapshotService): string {
  return [
    `# blocks/${service}`,
    "",
    `${SNAPSHOT_TITLES[service]}.`,
    "",
    "**Read-only snapshot.** `blocks pull` writes these files from the project's live setup.",
    "Editing them changes nothing on the server; use the commands below, then run",
    `\`blocks pull --only ${service}\` to refresh. Each file's \`_meta\` block records the`,
    "tenant and time it was pulled, so check it before trusting a file. Secret fields are",
    "redacted to `***` unless `--include-secrets` was passed.",
    "",
    "| File | Change with |",
    "|------|-------------|",
    ...SNAPSHOT_FILES[service].map(({ file, changeWith }) => `| \`${file}\` | \`${changeWith}\` |`),
    ""
  ].join("\n");
}

const DATA_README = [
  "# blocks/data",
  "",
  "Data Gateway schemas and access rules. Two-way: edit locally, then push.",
  "",
  "- `schemas/` -- `blocks data schema pull` writes it; `blocks data schema push` sends it back.",
  "- `rules.json` -- `blocks data rules pull` writes it; `blocks data rules deploy` sends it back.",
  "- `blocks data validate` checks both; `blocks data sync` pushes both.",
  ""
].join("\n");

const LOCALIZATION_README = [
  "# blocks/localization",
  "",
  "Localization dictionaries, one `<module>.<language>.json` file each. Two-way:",
  "`blocks localization pull` writes them, `blocks localization validate` checks them and",
  "`blocks localization push` sends them back.",
  ""
].join("\n");

const WORKFLOWS_README = [
  "# blocks/workflows",
  "",
  "Logic workflow exports. `blocks logic workflow export --all` writes them here (secrets",
  "redacted to `__REDACTED__`), and `blocks logic workflow import <file>` loads one back.",
  ""
].join("\n");

/**
 * Every file of the `blocks/` tree, as paths relative to the app root. Callers write
 * each one only if it's missing, so re-running never clobbers pulled or edited files.
 * `blocks/data/schemas/` holds no file of its own; callers create it as a directory.
 */
export function blocksFolderFiles(): Array<{ path: string; content: string }> {
  return [
    { path: "blocks/data/README.md", content: DATA_README },
    { path: "blocks/data/rules.json", content: `${JSON.stringify({ policies: [] }, null, 2)}\n` },
    { path: "blocks/localization/README.md", content: LOCALIZATION_README },
    { path: "blocks/workflows/README.md", content: WORKFLOWS_README },
    ...SNAPSHOT_SERVICES.map((service) => ({ path: `blocks/${service}/README.md`, content: snapshotReadme(service) }))
  ];
}
