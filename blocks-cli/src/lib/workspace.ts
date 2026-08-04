import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { parseFlags, stringFlag } from "./args.js";
import { readConfig, writeConfig } from "./config.js";

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
  const fromFlag = stringFlag(flags, "project");
  if (fromFlag) return fromFlag;

  const local = await readWorkspaceConfig();
  if (local.project?.tenantId) return local.project.tenantId;

  const global = await readConfig();
  if (global.selectedProject?.tenantId) return global.selectedProject.tenantId;

  throw new Error("No project selected. Run 'blocks-os use <tenantId>' or pass --project <tenantId>.");
}

export async function saveSelectedProject(tenantId: string): Promise<void> {
  const global = await readConfig();
  await writeConfig({
    ...global,
    selectedProject: {
      ...global.selectedProject,
      tenantId
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

export async function clearSelectedProject(): Promise<string | undefined> {
  const global = await readConfig();
  const tenantId = global.selectedProject?.tenantId;
  if (!tenantId) return undefined;

  const { selectedProject: _dropped, ...rest } = global;
  await writeConfig(rest);

  const local = await readWorkspaceConfig();
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
