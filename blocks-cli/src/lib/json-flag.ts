import { readFile } from "node:fs/promises";
import { stringFlag } from "./args.js";

type Flags = Record<string, string | boolean>;

/**
 * Reads a JSON object payload from `--body '<json>'` or `--file <path.json>`.
 * Rich IAM/MFA/Auth-admin payloads have far more optional fields than are
 * worth turning into individual flags; this is the escape hatch every
 * create/update command layers convenience flags on top of.
 */
export async function jsonBodyFlag(flags: Flags, options: { required?: boolean } = {}): Promise<Record<string, unknown>> {
  const inline = stringFlag(flags, "body");
  if (inline) return parseJsonObject(inline, "--body");

  const file = stringFlag(flags, "file");
  if (file) return parseJsonObject(await readFile(file, "utf8"), `--file ${file}`);

  if (options.required) throw new Error("Provide --body '<json>' or --file <path.json> with the request payload.");
  return {};
}

/** Splits a comma-separated flag value (e.g. `--roles admin,editor`) into a trimmed string array. */
export function listFlag(flags: Flags, name: string): string[] | undefined {
  const value = flags[name];
  if (typeof value !== "string" || !value) return undefined;
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

/** Parses a single named flag as an arbitrary JSON value (object or array), e.g. `--attachments '["a.pdf"]'`. */
export function jsonFlag(flags: Flags, name: string): unknown {
  const raw = stringFlag(flags, name);
  if (!raw) return undefined;

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse JSON from --${name}: ${(error as Error).message}`);
  }
}

/** Drops `undefined` values so unset convenience flags never overwrite a `--body`/`--file` payload's fields. */
export function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function parseJsonObject(text: string, source: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not parse JSON from ${source}: ${(error as Error).message}`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}
