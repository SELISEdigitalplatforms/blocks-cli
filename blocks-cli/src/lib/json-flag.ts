import { readFile } from "node:fs/promises";
import { stringFlag } from "./args.js";
import { CliActionableError } from "./errors.js";

type Flags = Record<string, string | boolean>;

/**
 * A UTF-8 BOM survives `readFile(path, "utf8")` and then makes `JSON.parse` fail on a
 * character that is invisible in the error message it produces. PowerShell's
 * `Out-File -Encoding utf8`, `Set-Content` and Notepad all write one, so `--file` --
 * the documented escape hatch from a shell-quoting problem -- failed too, with a
 * message that looked like the JSON itself was malformed.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * Diagnoses a payload that failed to parse because the calling shell mangled it, not
 * because the JSON was wrong. Two shapes turn up, and both are Windows-only:
 *
 *  - PowerShell drops the inner double quotes when handing an argument to a native
 *    executable, so `--body '{"a":1}'` reaches the CLI as `{a:1}`. JSON that opens
 *    with `{` or `[` always contains at least one double quote, so their total
 *    absence is conclusive.
 *  - cmd.exe gives single quotes no special meaning, so the same argument arrives
 *    with them still attached: `'{"a":1}'`.
 *
 * bash and zsh pass the documented form through untouched -- on macOS, on Linux, and
 * in Git Bash or WSL on Windows -- so neither shape can appear there. Without this
 * the parse error points at the JSON, which is the wrong layer to go and fix.
 */
function shellMangling(text: string): "stripped" | "wrapped" | undefined {
  const trimmed = text.trim();

  if ((trimmed.startsWith("{") || trimmed.startsWith("[")) && !trimmed.includes("\"")) return "stripped";

  const unwrapped = trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1
    ? trimmed.slice(1, -1).trim()
    : undefined;
  if (unwrapped && (unwrapped.startsWith("{") || unwrapped.startsWith("["))) return "wrapped";

  return undefined;
}

// Leads with the fix that needs no shell quoting anywhere, because the shell in use
// cannot be detected reliably (Git Bash and WSL both report win32). Deliberately
// describes the payload without echoing it: --body carries mail passwords, client
// secrets and connection strings on other commands.
const QUOTING_NEXT_STEP =
  "Put the payload in a file and pass --file <path.json>, which needs no shell quoting on any platform. "
  + "To keep it inline: in PowerShell write the JSON as '{\\\"key\\\":\\\"value\\\"}' (backslash-escaped "
  + "double quotes inside single quotes); in cmd.exe use \"{\"\"key\"\":\"\"value\"\"}\"; bash and zsh take "
  + "the documented '{\"key\":\"value\"}' form as-is.";

function shellManglingError(source: string, kind: "stripped" | "wrapped"): CliActionableError {
  const cause = kind === "stripped"
    ? `${source} contains no double quotes at all, so the shell removed them before the CLI saw the payload (PowerShell does this to a native command's arguments).`
    : `${source} arrived still wrapped in the literal single quotes it was written with, so the shell passed them through as part of the value (cmd.exe does this).`;

  return new CliActionableError(cause, "json_payload_shell_mangled", QUOTING_NEXT_STEP);
}

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

  const cleaned = stripBom(raw);
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const mangled = shellMangling(cleaned);
    if (mangled) throw shellManglingError(`--${name}`, mangled);
    throw new Error(`Could not parse JSON from --${name}: ${(error as Error).message}`);
  }
}

/** Drops `undefined` values so unset convenience flags never overwrite a `--body`/`--file` payload's fields. */
export function compact<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function parseJsonObject(text: string, source: string): Record<string, unknown> {
  const cleaned = stripBom(text);
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch (error) {
    const mangled = shellMangling(cleaned);
    if (mangled) throw shellManglingError(source, mangled);
    throw new Error(`Could not parse JSON from ${source}: ${(error as Error).message}`);
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${source} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}
