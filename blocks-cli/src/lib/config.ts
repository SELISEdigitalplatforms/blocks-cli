import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, platform } from "node:os";
import { dirname, join } from "node:path";

export type AccountProfile = {
  apiUrl: string;
  clientId: string;
  createdAt: string;
  oidcUrl: string;
  osUrl: string;
  rootTenantId?: string;
  scope: string;
  updatedAt: string;
};

export type TokenSet = {
  accessToken: string;
  accountTenant?: string;
  expiresAt?: string;
  idToken?: string;
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  scope?: string;
  tokenType?: string;
};

export type BlocksProjectSelection = {
  appDomain?: string;
  name?: string;
  tenantId: string;
};

export type BlocksCliConfig = {
  activeAccount?: string;
  accounts: Record<string, AccountProfile>;
  selectedProject?: BlocksProjectSelection;
};

const BAD_GATEWAY_OS_URL = "https://os.seliseblocks.com";
const DEFAULT_API_URL = "https://api.seliseblocks.com";
const DEFAULT_OS_CLIENT_ID = "4a633b13-1108-4fbf-84fd-b196c9dcdee2";
const DEFAULT_OIDC_URL = "https://iam.seliseblocks.com";
const DEFAULT_OS_URL = "https://api.seliseblocks.com";
const DEFAULT_PROFILE_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const DEFAULT_ROOT_TENANT_ID = "d7e5554c758541db8a18694b64ef423d";
const DEFAULT_SCOPE = "openid profile offline_access";

export function defaults(): { apiUrl: string; osClientId: string; oidcUrl: string; osUrl: string; rootTenantId: string; scope: string } {
  return {
    apiUrl: DEFAULT_API_URL,
    osClientId: DEFAULT_OS_CLIENT_ID,
    oidcUrl: DEFAULT_OIDC_URL,
    osUrl: DEFAULT_OS_URL,
    rootTenantId: DEFAULT_ROOT_TENANT_ID,
    scope: DEFAULT_SCOPE
  };
}

export function configDir(): string {
  const override = nonEmptyEnv("BLOCKS_CONFIG_DIR");
  if (override) return override;

  if (platform() === "win32") {
    return join(nonEmptyEnv("APPDATA") ?? join(homedir(), "AppData", "Roaming"), "seliseblocks", "cli");
  }

  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "seliseblocks", "cli");
  }

  return join(nonEmptyEnv("XDG_CONFIG_HOME") ?? join(homedir(), ".config"), "seliseblocks", "cli");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

export async function readConfig(): Promise<BlocksCliConfig> {
  try {
    const text = await readFile(configPath(), "utf8");
    return normalizeConfig(JSON.parse(text) as Partial<BlocksCliConfig>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultConfig();
    }

    throw error;
  }
}

export async function writeConfig(config: BlocksCliConfig): Promise<void> {
  const path = configPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeConfig(config), null, 2)}\n`, { mode: 0o600 });
}

export async function clearConfig(): Promise<void> {
  await rm(configPath(), { force: true });
}

export function normalizeAccountName(account?: string): string {
  return account?.trim() || "default";
}

export function getActiveAccountName(config: BlocksCliConfig, override?: string): string {
  const account = normalizeAccountName(override ?? config.activeAccount);
  if (!config.accounts[account]) {
    throw new Error("OIDC account is not configured.");
  }

  return account;
}

export function getAccountProfile(config: BlocksCliConfig, account?: string): { name: string; profile: AccountProfile } {
  const name = getActiveAccountName(config, account);
  return {
    name,
    profile: config.accounts[name]
  };
}

function normalizeConfig(config: Partial<BlocksCliConfig>): BlocksCliConfig {
  const env = defaults();
  const accounts: Record<string, AccountProfile> = {};
  for (const [name, profile] of Object.entries(config.accounts ?? {})) {
    accounts[name] = name === "default" ? defaultProfile(profile) : {
      ...profile,
      apiUrl: profile.apiUrl ?? env.apiUrl,
      clientId: profile.clientId ?? env.osClientId,
      createdAt: profile.createdAt ?? DEFAULT_PROFILE_TIMESTAMP,
      oidcUrl: profile.oidcUrl ?? env.oidcUrl,
      osUrl: !profile.osUrl || profile.osUrl === BAD_GATEWAY_OS_URL ? env.osUrl : profile.osUrl,
      rootTenantId: profile.rootTenantId ?? env.rootTenantId,
      scope: profile.scope ?? env.scope,
      updatedAt: profile.updatedAt ?? DEFAULT_PROFILE_TIMESTAMP
    };
  }

  if (Object.keys(accounts).length === 0) {
    return {
      ...defaultConfig(),
      selectedProject: config.selectedProject
    };
  }

  return {
    activeAccount: config.activeAccount ?? "default",
    accounts,
    selectedProject: config.selectedProject
  };
}

function defaultConfig(): BlocksCliConfig {
  return {
    activeAccount: "default",
    accounts: {
      default: defaultProfile()
    }
  };
}

function defaultProfile(existing?: Partial<AccountProfile>): AccountProfile {
  const env = defaults();
  return {
    apiUrl: env.apiUrl,
    clientId: env.osClientId,
    createdAt: existing?.createdAt ?? DEFAULT_PROFILE_TIMESTAMP,
    oidcUrl: env.oidcUrl,
    osUrl: env.osUrl,
    rootTenantId: env.rootTenantId,
    scope: env.scope,
    updatedAt: DEFAULT_PROFILE_TIMESTAMP
  };
}

function nonEmptyEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}
