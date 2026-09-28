import { AsyncLocalStorage } from "node:async_hooks";
import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "./config.js";
import { CliActionableError } from "./errors.js";

const context = new AsyncLocalStorage<boolean>();
const LOCK_NAME = ".auth-transition.lock";
const LOCK_TIMEOUT_MS = 30_000;
const RETRY_MS = 100;
const STALE_MS = 120_000;

export async function withAuthTransitionLock<T>(operation: () => Promise<T>): Promise<T> {
  if (context.getStore()) return await operation();

  const directory = configDir();
  const lockPath = join(directory, LOCK_NAME);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  await mkdir(directory, { recursive: true });

  while (true) {
    try {
      await mkdir(lockPath);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (await isStale(lockPath)) {
        await rm(lockPath, { force: true, recursive: true });
        continue;
      }
      if (Date.now() >= deadline) {
        throw new CliActionableError(
          "Another Blocks CLI process is changing the authentication session.",
          "auth_transition_busy",
          "Wait for the other command to finish, then retry."
        );
      }
      await delay(RETRY_MS);
    }
  }

  try {
    return await context.run(true, operation);
  } finally {
    await rm(lockPath, { force: true, recursive: true });
  }
}

async function isStale(path: string): Promise<boolean> {
  try {
    return Date.now() - (await stat(path)).mtimeMs > STALE_MS;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
