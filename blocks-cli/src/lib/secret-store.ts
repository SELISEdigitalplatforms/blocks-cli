import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { platform } from "node:os";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { configDir } from "./config.js";
import { CliActionableError } from "./errors.js";

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
    // Promotion into the native store is opportunistic: this is a read that
    // already has the value, so a broken native backend must not turn it into
    // a failure. The fallback entry stays until a promotion round-trips.
    try {
      await setSecretValue(key, fallback);
      await removeFallbackSecret(account);
    } catch {
      // keep serving the fallback copy
    }
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
    // Encrypt-then-decrypt before anything is persisted: a PowerShell or DPAPI
    // profile problem must fail the write loudly instead of storing a blob
    // that can never be read back (which looks like "logged out" later).
    let encrypted: string;
    try {
      encrypted = await protectWindowsSecret(value);
    } catch (error) {
      throw secretWriteFailed("Windows DPAPI", error);
    }
    if (await unprotectWindowsSecret(encrypted) !== value) {
      throw secretWriteFailed("Windows DPAPI");
    }
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
  const forced = process.env.BLOCKS_SECRET_STORE;
  if (forced === "file") return "file";
  // An explicit native backend skips platform detection and probing. This is
  // how the test suite exercises the native code paths deterministically on
  // any OS; write verification below makes a wrong override fail loudly
  // rather than silently losing credentials.
  if (forced === "windows-dpapi" || forced === "macos-keychain" || forced === "linux-secret-service") return forced;
  if (platform() === "win32") return "windows-dpapi";
  // Probed rather than assumed, the same way secret-tool is on Linux: on a
  // machine where `security` is missing or blocked by policy, claiming the
  // keychain backend would make every login throw instead of falling through
  // to the documented 0600-file tier.
  if (platform() === "darwin" && await commandAvailable("security", ["help"])) return "macos-keychain";
  if (platform() === "linux" && await commandAvailable("secret-tool", ["--help"])) return "linux-secret-service";
  return "file";
}

async function commandAvailable(command: string, args: string[]): Promise<boolean> {
  try {
    await execFileAsync(command, args);
    return true;
  } catch {
    return false;
  }
}

/**
 * The plaintext reaches PowerShell on stdin rather than through an environment
 * variable. A process's environment block is readable by other processes running
 * as the same user, which is the same boundary DPAPI itself protects, so this is
 * hardening rather than a fix -- but stdin is never exposed that way and costs
 * nothing here.
 */
async function protectWindowsSecret(secret: string): Promise<string> {
  return await spawnWithInputCapturingStdout("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "$plain = [Console]::In.ReadToEnd(); $secure = ConvertTo-SecureString $plain -AsPlainText -Force; $secure | ConvertFrom-SecureString"
  ], secret);
}

async function unprotectWindowsSecret(secret: string): Promise<string | undefined> {
  try {
    const stdout = await spawnWithInputCapturingStdout("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "$blob = [Console]::In.ReadToEnd().Trim(); $secure = ConvertTo-SecureString $blob; $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { if ($bstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) } }"
    ], secret);
    return stdout || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Writes through argv (`-w <secret>`) and then reads the item back before
 * reporting success. An earlier revision piped the secret to `security` on
 * stdin (`-w` with no value) to keep it out of the process argument list, but
 * on a real Mac that form does not round-trip: `security` prompts the
 * controlling terminal (`/dev/tty`), ignores the pipe, stores an EMPTY
 * password, and still exits 0 -- so logins reported success while the tokens
 * were already gone. The argv exposure lasts only for the life of the
 * short-lived `security` call; a write that cannot be read back throws instead
 * of pretending it worked.
 */
async function setMacSecret(account: string, secret: string): Promise<void> {
  try {
    await execFileAsync("security", ["add-generic-password", "-a", nativeSecretAccount(account), "-s", SERVICE, "-U", "-w", secret]);
  } catch (error) {
    throw secretWriteFailed("macOS Keychain", error);
  }
  if (await getMacSecret(account) !== secret) {
    throw secretWriteFailed("macOS Keychain");
  }
}

async function getMacSecret(account: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("security", ["find-generic-password", "-a", nativeSecretAccount(account), "-s", SERVICE, "-w"]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function removeMacSecret(account: string): Promise<void> {
  if (platform() !== "darwin") return;
  await execFileAsync("security", ["delete-generic-password", "-a", nativeSecretAccount(account), "-s", SERVICE]);
}

async function setLinuxSecret(account: string, secret: string): Promise<void> {
  const namespacedAccount = nativeSecretAccount(account);
  try {
    await spawnWithInput("secret-tool", ["store", "--label", `Blocks CLI ${namespacedAccount}`, "service", SERVICE, "account", namespacedAccount], secret);
  } catch (error) {
    throw secretWriteFailed("Linux Secret Service", error);
  }
  // Exit 0 is not proof the secret landed (a locked or misbehaving keyring can
  // still report success), so only a successful read-back counts.
  if (await getLinuxSecret(account) !== secret) {
    throw secretWriteFailed("Linux Secret Service");
  }
}

async function getLinuxSecret(account: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync("secret-tool", ["lookup", "service", SERVICE, "account", nativeSecretAccount(account)]);
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}

async function removeLinuxSecret(account: string): Promise<void> {
  if (platform() !== "linux") return;
  await execFileAsync("secret-tool", ["clear", "service", SERVICE, "account", nativeSecretAccount(account)]);
}

/**
 * Every native write is verified by reading the value back; this is the error
 * for a write that did not persist. The message carries the backend name and
 * the underlying tool error only -- never the secret itself.
 */
function secretWriteFailed(backend: string, cause?: unknown): CliActionableError {
  const detail = cause instanceof Error && cause.message ? `: ${cause.message}` : ".";
  return new CliActionableError(
    `Could not save credentials -- the ${backend} write did not persist${detail} Existing local auth state was left untouched.`,
    "secret_store_write_failed",
    "Set BLOCKS_SECRET_STORE=file to use the 0600-file store, then retry."
  );
}

function nativeSecretAccount(account: string): string {
  const override = process.env.BLOCKS_CONFIG_DIR?.trim();
  if (!override) return account;

  const namespace = createHash("sha256").update(resolve(override)).digest("hex").slice(0, 16);
  return `${namespace}:${account}`;
}

/** `spawnWithInput`, but resolves the child's trimmed stdout. */
function spawnWithInputCapturingStdout(command: string, args: string[], inputText: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
        return;
      }

      reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });

    child.stdin.end(inputText);
  });
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
