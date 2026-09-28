import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { configDir } from "./config.js";

// Agent sessions keep running whatever CLI version was installed months ago and
// never find out a newer one exists until a flag or command is missing. This
// module closes that gap passively: at most once a day it asks the npm registry
// for the latest published version, caches the answer next to the CLI config,
// and prints a short stderr notice on every command while the installed version
// is behind. It only ever informs -- updating stays a user decision.
const PACKAGE_NAME = "@seliseblocks/cli-os";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2000;
const CACHE_FILE = "update-check.json";

export type UpdateCheckCache = { checkedAt: string; latest: string };

export async function installedCliVersion(): Promise<string> {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const pkg = JSON.parse(await readFile(packageUrl, "utf8")) as { version?: string };
  return pkg.version ?? "0.0.0";
}

/** Cached result of the last registry lookup, if one has ever completed. */
export async function readUpdateCheckCache(): Promise<UpdateCheckCache | undefined> {
  try {
    const raw = JSON.parse(await readFile(join(configDir(), CACHE_FILE), "utf8")) as UpdateCheckCache;
    return typeof raw?.latest === "string" && typeof raw?.checkedAt === "string" ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * True when `candidate` is a strictly newer semver than `current`. Prerelease
 * tags are compared only as "a prerelease of X is older than plain X" -- the
 * registry's `latest` dist-tag never points at a prerelease, so finer ordering
 * would be dead code here.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  const parse = (version: string): { parts: number[]; prerelease: boolean } => {
    const [core, prerelease] = version.split("-", 2);
    const parts = core.split(".").map((part) => Number.parseInt(part, 10));
    return { parts: [parts[0] || 0, parts[1] || 0, parts[2] || 0], prerelease: Boolean(prerelease) };
  };

  const next = parse(candidate);
  const now = parse(current);
  for (let index = 0; index < 3; index++) {
    if (next.parts[index] !== now.parts[index]) return next.parts[index] > now.parts[index];
  }
  return now.prerelease && !next.prerelease;
}

async function fetchLatestVersion(): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(REGISTRY_URL, { signal: controller.signal });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { version?: string };
    return typeof body.version === "string" && /^\d+\.\d+\.\d+/.test(body.version) ? body.version : undefined;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

async function latestKnownVersion(): Promise<string | undefined> {
  const cached = await readUpdateCheckCache();
  if (cached && Date.now() - Date.parse(cached.checkedAt) < CHECK_INTERVAL_MS) return cached.latest;

  const latest = await fetchLatestVersion();
  if (!latest) return cached?.latest;

  try {
    await mkdir(configDir(), { recursive: true });
    const cache: UpdateCheckCache = { checkedAt: new Date().toISOString(), latest };
    await writeFile(join(configDir(), CACHE_FILE), `${JSON.stringify(cache)}\n`);
  } catch {
    // A cache that cannot be written just means the next command re-fetches.
  }
  return latest;
}

/**
 * Runs after every command from the entry point. stderr only, so a --json
 * document being piped into a parser is never touched, and every failure mode
 * (offline, registry down, unwritable config dir) is silent -- an update
 * notice must never break or slow the command the user actually ran beyond
 * the one short registry timeout a day.
 */
export async function maybePrintUpdateNotice(): Promise<void> {
  if (process.env.BLOCKS_NO_UPDATE_CHECK) return;
  try {
    const current = await installedCliVersion();
    const latest = await latestKnownVersion();
    if (!latest || !isNewerVersion(latest, current)) return;

    console.error(`\nUpdate available: ${PACKAGE_NAME} ${current} -> ${latest}.`);
    console.error(`Run 'npm install -g ${PACKAGE_NAME}@latest' to update.`);
    console.error("Agent sessions: tell the user a newer CLI is published and ask for their confirmation before updating. Never update on your own.");
  } catch {
    // Never let the update check surface as a command failure.
  }
}
