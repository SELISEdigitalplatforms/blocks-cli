import { execFile, spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { configDir } from "./config.js";

const execFileAsync = promisify(execFile);
const SERVICE = "seliseblocks-cli";

export type SecretBackend = "windows-dpapi" | "macos-keychain" | "linux-secret-service" | "file";

export type BlocksSecretStore = {
  accounts: Record<string, {
    clientSecret?: string;
    clientSecretDpapi?: string;
  }>;
};

export type SecretStoreInfo = {
  backend: SecretBackend;
  detail: string;
  path?: string;
};

export function secretPath(): string {
  return join(configDir(), "secrets.json");
}

export async function secretStoreInfo(): Promise<SecretStoreInfo> {
  const backend = await resolveBackend();
  if (backend === "windows-dpapi") return { backend, detail: "Windows DPAPI encrypted file", path: secretPath() };
  if (backend === "macos-keychain") return { backend, detail: "macOS Keychain generic password" };
  if (backend === "linux-secret-service") return { backend, detail: "Linux Secret Service via secret-tool" };
  return { backend, detail: "0600 file fallback", path: secretPath() };
}

export async function readSecretStore(): Promise<BlocksSecretStore> {
  try {
    return normalizeSecretStore(JSON.parse(await readFile(secretPath(), "utf8")) as Partial<BlocksSecretStore>);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { accounts: {} };
    throw error;
  }
}

export async function writeSecretStore(store: BlocksSecretStore): Promise<void> {
  const path = secretPath();
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(normalizeSecretStore(store), null, 2)}\n`, { mode: 0o600 });
}

export async function setClientSecret(account: string, clientSecret: string): Promise<void> {
  await setSecretValue(`client-secret:${account}`, clientSecret);
  await removeFallbackSecret(account);
}

export async function getClientSecret(account: string): Promise<string | undefined> {
  const key = `client-secret:${account}`;
  const secured = await getSecretValue(key);
  if (secured) return secured;

  const fallback = await getFallbackClientSecret(account);
  if (!fallback) return undefined;

  const backend = await resolveBackend();
  if (backend !== "file") {
    await setSecretValue(key, fallback);
    await removeFallbackSecret(account);
  }

  return fallback;
}

export async function removeAccountSecrets(account: string): Promise<void> {
  await removeSecretValue(`client-secret:${account}`);
  await removeFallbackSecret(account);
}

export async function setSecretValue(key: string, value: string): Promise<void> {
  const backend = await resolveBackend();

  if (backend === "macos-keychain") {
    await setMacSecret(key, value);
    return;
  }

  if (backend === "linux-secret-service") {
    await setLinuxSecret(key, value);
    return;
  }

  if (backend === "windows-dpapi") {
    const encrypted = await protectWindowsSecret(value);
    const store = await readSecretStore();
    await writeSecretStore({
      accounts: {
        ...store.accounts,
        [key]: {
          ...store.accounts[key],
          clientSecret: undefined,
          clientSecretDpapi: encrypted
        }
      }
    });
    return;
  }

  const store = await readSecretStore();
  await writeSecretStore({
    accounts: {
      ...store.accounts,
      [key]: {
        ...store.accounts[key],
        clientSecret: value
      }
    }
  });
}

export async function getSecretValue(key: string): Promise<string | undefined> {
  const backend = await resolveBackend();

  if (backend === "macos-keychain") {
    const secret = await getMacSecret(key);
    if (secret) return secret;
  }

  if (backend === "linux-secret-service") {
    const secret = await getLinuxSecret(key);
    if (secret) return secret;
  }

  const store = await readSecretStore();
  const entry = store.accounts[key];
  if (!entry) return undefined;

  if (backend === "windows-dpapi" && entry.clientSecretDpapi) {
    return await unprotectWindowsSecret(entry.clientSecretDpapi);
  }

  return entry.clientSecret;
}

export async function removeSecretValue(key: string): Promise<void> {
  await Promise.allSettled([
    removeMacSecret(key),
    removeLinuxSecret(key)
  ]);
  await removeFallbackSecret(key);
}

async function removeFallbackSecret(key: string): Promise<void> {
  const store = await readSecretStore();
  if (!store.accounts[key]) return;

  const { [key]: _, ...accounts } = store.accounts;
  await writeSecretStore({ accounts });
}

async function getFallbackClientSecret(account: string): Promise<string | undefined> {
  const store = await readSecretStore();
  return store.accounts[account]?.clientSecret;
}

function normalizeSecretStore(store?: Partial<BlocksSecretStore>): BlocksSecretStore {
  return {
    accounts: store?.accounts ?? {}
  };
}

async function resolveBackend(): Promise<SecretBackend> {
  if (process.env.BLOCKS_SECRET_STORE === "file") return "file";
  if (platform() === "win32") return "windows-dpapi";
  if (platform() === "darwin") return "macos-keychain";
  if (platform() === "linux" && await commandAvailable("secret-tool")) return "linux-secret-service";
  return "file";
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--help"]);
    return true;
  } catch {
    return false;
  }
}

async function protectWindowsSecret(secret: string): Promise<string> {
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$secure = ConvertTo-SecureString $env:BLOCKS_SECRET_INPUT -AsPlainText -Force; $secure | ConvertFrom-SecureString"
  ], {
    env: { ...process.env, BLOCKS_SECRET_INPUT: secret }
  });
  return stdout.trim();
}

async function unprotectWindowsSecret(secret: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$secure = ConvertTo-SecureString $env:BLOCKS_SECRET_INPUT; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } }"
    ], {
      env: { ...process.env, BLOCKS_SECRET_INPUT: secret }
    });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function setMacSecret(account: string, secret: string): Promise<void> {
  await execFileAsync("security", ["add-generic-password", "-a", account, "-s", SERVICE, "-w", secret, "-U"]);
}

async function getMacSecret(account: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("security", ["find-generic-password", "-a", account, "-s", SERVICE, "-w"]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function removeMacSecret(account: string): Promise<void> {
  if (platform() !== "darwin") return;
  await execFileAsync("security", ["delete-generic-password", "-a", account, "-s", SERVICE]);
}

async function setLinuxSecret(account: string, secret: string): Promise<void> {
  await spawnWithInput("secret-tool", ["store", "--label", `Blocks CLI ${account}`, "service", SERVICE, "account", account], secret);
}

async function getLinuxSecret(account: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("secret-tool", ["lookup", "service", SERVICE, "account", account]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function removeLinuxSecret(account: string): Promise<void> {
  if (platform() !== "linux") return;
  await execFileAsync("secret-tool", ["clear", "service", SERVICE, "account", account]);
}

function spawnWithInput(command: string, args: string[], inputText: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
    let stderr = "";

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });

    child.stdin.end(inputText);
  });
}
