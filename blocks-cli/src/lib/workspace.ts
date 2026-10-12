import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseFlags, stringFlag } from "./args.js";
import { CliActionableError } from "./errors.js";
import { BlocksProjectSelection, readConfig, resolveAccountProfile, writeConfig } from "./config.js";
import { isInteractive, promptText } from "./prompt.js";

export type BlocksWorkspaceConfig = {
  data?: {
    rules?: string;
    schemas?: string;
  };
  localization?: {
    dictionaries?: string;
  };
  /** Logic workflow bindings: relative file path → workflowId (Phase 1 create-only). */
  logic?: {
    workflows?: Record<string, string>;
  };
  project?: {
    apiUrl?: string;
    appDomain?: string;
    tenantId?: string;
  };
  /** Optional git repo binding written by `blocks git init/connect`. */
  repo?: Record<string, unknown>;
};

export async function readWorkspaceConfig(): Promise<BlocksWorkspaceConfig> {
  try {
    return JSON.parse(await readFile("blocks.json", "utf8")) as BlocksWorkspaceConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

export async function writeWorkspaceConfig(config: BlocksWorkspaceConfig): Promise<void> {
  await writeFile("blocks.json", `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * The nearest blocks.json at or above the working directory -- the workspace
 * that owns the project selection for every command run inside it. Stops
 * below the home directory and the filesystem root so a stray file there
 * can't bind every directory beneath it.
 */
export async function findWorkspace(): Promise<{ config: BlocksWorkspaceConfig; path: string } | undefined> {
  const home = resolve(homedir());
  let dir = resolve(process.cwd());
  while (dir !== home && dirname(dir) !== dir) {
    const path = join(dir, "blocks.json");
    try {
      return { config: JSON.parse(await readFile(path, "utf8")) as BlocksWorkspaceConfig, path };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    dir = dirname(dir);
  }
  return undefined;
}

export async function selectedProject(flags: Record<string, string | boolean>): Promise<string> {
  const selected = await optionalSelectedProject(flags);
  if (selected) return selected;

  if (!flags.json && isInteractive()) {
    const tenantId = await promptText("Project tenant ID: ");
    if (tenantId) return tenantId;
  }

  throw new CliActionableError(
    "No project is selected in the current context.",
    "project_not_selected",
    "Pass --project <tenantId> or run 'blocks use <tenantId>' in this workspace."
  );
}

export async function optionalSelectedProject(flags: Record<string, string | boolean>): Promise<string | undefined> {
  const fromFlag = stringFlag(flags, "project");
  if (fromFlag) return fromFlag;

  // A workspace owns its selection outright. Falling through to the account's
  // selection here is what let two agents in different project directories
  // share one project: whichever ran 'blocks use' last redirected the other.
  const workspace = await findWorkspace();
  if (workspace) return workspace.config.project?.tenantId || undefined;

  const global = await readConfig();
  const accountOverride = stringFlag(flags, "account") || undefined;
  const { profile } = await resolveAccountProfile(global, accountOverride);
  if (profile.selectedProject?.tenantId) return profile.selectedProject.tenantId;

  return undefined;
}

export async function saveSelectedProject(
  tenantId: string,
  accountOverride?: string,
  details: Omit<BlocksProjectSelection, "tenantId"> = {}
): Promise<void> {
  const global = await readConfig();
  const { name, profile } = await resolveAccountProfile(global, accountOverride);
  await writeConfig({
    ...global,
    accounts: {
      ...global.accounts,
      [name]: {
        ...profile,
        selectedProject: {
          ...profile.selectedProject,
          ...details,
          tenantId
        }
      }
    }
  });

  // Pin the selection to this workspace -- creating blocks.json if there is
  // none yet -- so a 'blocks use' in another directory can't retarget it. The
  // home directory is never pinned; there the account selection alone applies.
  const workspace = await findWorkspace();
  const cwd = resolve(process.cwd());
  const path = workspace?.path ?? (cwd === resolve(homedir()) || dirname(cwd) === cwd ? undefined : join(cwd, "blocks.json"));
  if (path) {
    const local = workspace?.config ?? {};
    await writeFile(path, `${JSON.stringify({
      ...local,
      project: {
        ...local.project,
        tenantId
      }
    }, null, 2)}\n`);
  }
}

export async function clearSelectedProject(accountOverride?: string): Promise<string | undefined> {
  const global = await readConfig();
  const { name, profile } = await resolveAccountProfile(global, accountOverride);
  const workspace = await findWorkspace();
  const local = workspace?.config ?? {};
  const tenantId = local.project?.tenantId || profile.selectedProject?.tenantId;

  if (profile.selectedProject) {
    const { selectedProject: _dropped, ...restProfile } = profile;
    await writeConfig({
      ...global,
      accounts: { ...global.accounts, [name]: restProfile }
    });
  }

  if (workspace && local.project?.tenantId) {
    const { tenantId: _localTenantId, ...restProject } = local.project;
    await writeFile(workspace.path, `${JSON.stringify({
      ...local,
      project: Object.keys(restProject).length > 0 ? restProject : undefined
    }, null, 2)}\n`);
  }

  return tenantId;
}

export function pathsFromWorkspace(config: BlocksWorkspaceConfig): { dictionaries: string; rules: string; schemas: string } {
  return {
    dictionaries: config.localization?.dictionaries ?? "blocks/localization",
    rules: config.data?.rules ?? "blocks/data/rules.json",
    schemas: config.data?.schemas ?? "blocks/data/schemas"
  };
}

export async function ensureParent(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}

export function parseCommand(argv: string[]): ReturnType<typeof parseFlags> {
  return parseFlags(argv);
}

export function workspacePath(...segments: string[]): string {
  return join(process.cwd(), ...segments);
}
