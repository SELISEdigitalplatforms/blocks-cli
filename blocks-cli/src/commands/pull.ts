import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { booleanFlag, stringFlag } from "../lib/args.js";
import { SNAPSHOT_FILES, SNAPSHOT_SERVICES, type SnapshotService } from "../lib/blocks-folders.js";
import { CliActionableError } from "../lib/errors.js";
import { listFlag } from "../lib/json-flag.js";
import { writeOutput } from "../lib/output.js";
import { redactSnapshot, SNAPSHOT_FETCHERS } from "../lib/snapshots.js";
import { installedCliVersion } from "../lib/update-check.js";
import { findWorkspace, parseCommand, selectedProject } from "../lib/workspace.js";

/**
 * Writes a read-only snapshot of the project's IAM, auth, mail, storage, release
 * and logic setup into blocks/<service>/, so an agent can read it without calling
 * the CLI. Read-only on the server. Every file is wrapped in a `_meta` block
 * (tenant, time, CLI version) so a stale or other-project snapshot is visible,
 * and secrets are redacted unless --include-secrets is passed. One service
 * failing doesn't stop the others; the failure is reported and the exit code
 * is non-zero.
 */
export async function pull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const includeSecrets = booleanFlag(flags, "include-secrets");
  const services = resolveServices(listFlag(flags, "only"));

  // The workspace owns its project selection, so the only way to pull another
  // tenant into it is --project. That would overwrite this app's snapshot with
  // another project's setup, so it needs --force.
  const workspace = await findWorkspace();
  const workspaceTenant = workspace?.config.project?.tenantId;
  if (workspaceTenant && workspaceTenant !== projectKey && !booleanFlag(flags, "force")) {
    throw new CliActionableError(
      `--project ${stringFlag(flags, "project")} is not this workspace's project (${workspaceTenant}).`,
      "pull_tenant_mismatch",
      "Drop --project to pull this workspace's project, or pass --force to overwrite the snapshot with another project's setup."
    );
  }

  const meta = {
    cliVersion: await installedCliVersion(),
    note: "Read-only snapshot written by 'blocks pull'. Editing it changes nothing; use the blocks <service> commands, then pull again.",
    pulledAt: new Date().toISOString(),
    readOnly: true,
    secretsRedacted: !includeSecrets,
    tenantId: projectKey
  };

  const written: string[] = [];
  const failed: Array<{ service: SnapshotService; file: string; error: string }> = [];
  let redacted = 0;

  // Write next to blocks.json when run from a subdirectory, so the snapshot lands
  // in the app's own blocks/ tree rather than a new one under the cwd.
  const root = workspace ? dirname(workspace.path) : process.cwd();
  for (const service of services) {
    const dir = join(root, "blocks", service);
    await mkdir(dir, { recursive: true });
    for (const { file } of SNAPSHOT_FILES[service]) {
      try {
        const raw = await SNAPSHOT_FETCHERS[service][file]({ flags, projectKey });
        const result = includeSecrets ? { redacted: 0, value: raw } : redactSnapshot(raw);
        redacted += result.redacted;
        const path = join(dir, file);
        await writeFile(path, `${JSON.stringify({ _meta: { ...meta, service }, data: result.value }, null, 2)}\n`);
        written.push(join("blocks", service, file));
      } catch (error) {
        failed.push({ error: (error as Error).message, file, service });
      }
    }
  }

  const warnings: string[] = [];
  if (includeSecrets) warnings.push("Pulled WITH secrets in cleartext (--include-secrets). Do not commit these files.");
  else if (redacted > 0) warnings.push(`Redacted ${redacted} secret value(s) to ***.`);

  if (failed.length > 0) process.exitCode = 1;

  if (flags.json) {
    writeOutput({ failed, services, tenantId: projectKey, written, ...(warnings.length ? { warnings } : {}) }, flags);
    return;
  }
  console.log(`Pulled ${written.length} file(s) for ${projectKey} into blocks/.`);
  for (const path of written) console.log(`  ${path}`);
  for (const failure of failed) console.log(`Failed: blocks/${failure.service}/${failure.file}: ${failure.error}`);
  for (const warning of warnings) console.log(`Warning: ${warning}`);
}

function resolveServices(only: string[] | undefined): SnapshotService[] {
  if (!only || only.length === 0) return [...SNAPSHOT_SERVICES];
  const unknown = only.filter((name) => !SNAPSHOT_SERVICES.includes(name as SnapshotService));
  if (unknown.length > 0) {
    throw new CliActionableError(
      `Unknown service(s) for --only: ${unknown.join(", ")}.`,
      "pull_unknown_service",
      `Choose from: ${SNAPSHOT_SERVICES.join(", ")}.`
    );
  }
  return only as SnapshotService[];
}
