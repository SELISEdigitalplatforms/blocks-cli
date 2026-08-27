import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
  project?: {
    apiUrl?: string;
    appDomain?: string;
    tenantId?: string;
  };
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
    "Pass --project <tenantId> or run 'blocks use <tenantId>'."
  );
}

export async function optionalSelectedProject(flags: Record<string, string | boolean>): Promise<string | undefined> {
  const fromFlag = stringFlag(flags, "project");
  if (fromFlag) return fromFlag;

  const local = await readWorkspaceConfig();
  if (local.project?.tenantId) return local.project.tenantId;

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

  const local = await readWorkspaceConfig();
  if (Object.keys(local).length > 0) {
    await writeWorkspaceConfig({
      ...local,
      project: {
        ...local.project,
        tenantId
      }
    });
  }
}

export async function clearSelectedProject(accountOverride?: string): Promise<string | undefined> {
  const global = await readConfig();
  const { name, profile } = await resolveAccountProfile(global, accountOverride);
  const local = await readWorkspaceConfig();
  const tenantId = local.project?.tenantId ?? profile.selectedProject?.tenantId;

  if (profile.selectedProject) {
    const { selectedProject: _dropped, ...restProfile } = profile;
    await writeConfig({
      ...global,
      accounts: { ...global.accounts, [name]: restProfile }
    });
  }

  if (local.project?.tenantId) {
    const { tenantId: _localTenantId, ...restProject } = local.project;
    await writeWorkspaceConfig({
      ...local,
      project: Object.keys(restProject).length > 0 ? restProject : undefined
    });
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
