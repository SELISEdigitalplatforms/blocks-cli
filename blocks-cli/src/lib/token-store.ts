import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { configDir, configPath, TokenSet } from "./config.js";
import { CliActionableError } from "./errors.js";
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
  if (secured) {
    try {
      return normalizeTokenStore(JSON.parse(secured) as Partial<BlocksTokenStore>);
    } catch {
      // A stale or manually created credential-store entry in the CLI's slot
      // must surface as an actionable problem, not a raw SyntaxError crash.
      throw new CliActionableError(
        "The OS credential store returned data that is not a Blocks token store. A stale or manually created entry may be occupying the CLI's slot.",
        "token_store_unreadable",
        `Remove the '${TOKEN_SECRET_KEY}' entry for service 'seliseblocks-cli' from the OS credential store (or set BLOCKS_SECRET_STORE=file), then run 'blocks login'.`
      );
    }
  }

  try {
    const legacy = normalizeTokenStore(JSON.parse(await readFile(tokenPath(), "utf8")) as Partial<BlocksTokenStore>);
    if ((await secretStoreInfo()).backend !== "file") {
      await migrateTokenStoreBestEffort(legacy);
    }
    return legacy;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const migrated = await readLegacyTokens();
  const normalized = normalizeTokenStore(migrated);
  if (migrated && (await secretStoreInfo()).backend !== "file") {
    await migrateTokenStoreBestEffort(normalized);
  }
  return normalized;
}

/**
 * Migrating file-based tokens into a native store happens on the READ path, so
 * it must never take a command down or destroy the only readable copy: on a
 * failed native write, `writeTokenStore` throws before `tokens.json` is
 * removed, and this keeps serving the file until a migration round-trips.
 */
async function migrateTokenStoreBestEffort(store: BlocksTokenStore): Promise<void> {
  try {
    await writeTokenStore(store);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`Warning: could not migrate tokens into the OS credential store (${detail}) Continuing with the existing token file.`);
  }
}

export async function writeTokenStore(store: BlocksTokenStore): Promise<void> {
  const info = await secretStoreInfo();
  if (info.backend !== "file") {
    // setSecretValue verifies the write by reading it back and throws when the
    // round-trip fails, so tokens.json below is only ever removed once the
    // native store has proven it holds the tokens.
    await setSecretValue(TOKEN_SECRET_KEY, toAsciiJson(normalizeTokenStore(store)));
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

/**
 * JSON with every non-ASCII character escaped to \uXXXX. `security
 * find-generic-password -w` hex-dumps values holding non-ASCII bytes, which
 * would make the write verification reject an otherwise good store (a project
 * name can be unicode even though the tokens themselves are base64url ASCII).
 * The escaped form parses to the identical object.
 */
function toAsciiJson(store: BlocksTokenStore): string {
  return JSON.stringify(store).replace(/[\u007f-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
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
