import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { configDir, configPath, TokenSet } from "./config.js";
import { getSecretValue, secretStoreInfo, setSecretValue } from "./secret-store.js";

export type AccountTokenStore = {
  account?: TokenSet;
  projects?: Record<string, TokenSet>;
};

export type BlocksTokenStore = {
  accounts: Record<string, AccountTokenStore>;
};

const TOKEN_SECRET_KEY = "oauth-token-store";

export function tokenPath(): string {
  return join(configDir(), "tokens.json");
}

export async function tokenStoreInfo(): Promise<{ backend: string; detail: string; path?: string }> {
  const secretInfo = await secretStoreInfo();
  if (secretInfo.backend === "file") return { backend: "file", detail: "0600 token file", path: tokenPath() };
  return {
    backend: secretInfo.backend,
    detail: `OAuth tokens stored with ${secretInfo.detail}`,
    path: secretInfo.path
  };
}

export async function readTokenStore(): Promise<BlocksTokenStore> {
  const secured = await getSecretValue(TOKEN_SECRET_KEY);
  if (secured) return normalizeTokenStore(JSON.parse(secured) as Partial<BlocksTokenStore>);

  try {
    const legacy = normalizeTokenStore(JSON.parse(await readFile(tokenPath(), "utf8")) as Partial<BlocksTokenStore>);
    if ((await secretStoreInfo()).backend !== "file") {
      await writeTokenStore(legacy);
    }
    return legacy;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const migrated = await readLegacyTokens();
  const normalized = normalizeTokenStore(migrated);
  if (migrated && (await secretStoreInfo()).backend !== "file") {
    await writeTokenStore(normalized);
  }
  return normalized;
}

export async function writeTokenStore(store: BlocksTokenStore): Promise<void> {
  const info = await secretStoreInfo();
  if (info.backend !== "file") {
    await setSecretValue(TOKEN_SECRET_KEY, JSON.stringify(normalizeTokenStore(store)));
    await rm(tokenPath(), { force: true });
    return;
  }

  const path = tokenPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeTokenStore(store), null, 2)}\n`, { mode: 0o600 });
}

export async function removeAccountTokens(account: string): Promise<void> {
  const store = await readTokenStore();
  if (!store.accounts[account]) return;

  const { [account]: _, ...accounts } = store.accounts;
  await writeTokenStore({ accounts });
}

function normalizeTokenStore(store?: Partial<BlocksTokenStore>): BlocksTokenStore {
  return {
    accounts: store?.accounts ?? {}
  };
}

async function readLegacyTokens(): Promise<BlocksTokenStore | undefined> {
  try {
    const legacy = JSON.parse(await readFile(configPath(), "utf8")) as {
      tokens?: BlocksTokenStore["accounts"];
    };
    if (legacy.tokens) return { accounts: legacy.tokens };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return undefined;
}
