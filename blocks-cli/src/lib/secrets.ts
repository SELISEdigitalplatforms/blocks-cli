import { readFile } from "node:fs/promises";
import { CliActionableError } from "./errors.js";

/**
 * blocks-os SecretsController ([Route("[controller]")] -> /Secrets): the project's
 * secret store, one named record per secret with status, access list, rotation and audit.
 * The CLI never reads a value back -- there is deliberately no command on the server's
 * value/values endpoints -- so nothing a command prints can contain one.
 */
export const OS_SECRETS_API = "/os/v4/Secrets";

/**
 * The only type the CLI ever writes (Blocks.Secrets SecretTypes.Api, also the server
 * default). The other server type is reserved for platform-managed secrets and is never
 * sent from here, so 'set' and 'set-many' pin it rather than exposing a flag.
 */
export const SECRET_TYPE = "api";

// Blocks.Secrets SecretStatuses.
export const SECRET_STATUSES = ["active", "locked", "deleted"] as const;

export type SecretResult = {
  secretId?: string;
  name?: string;
  description?: string;
  type?: string;
  status?: string;
  organizationId?: string;
  access?: { userIds?: string[]; roles?: string[] } | null;
  canReadValue?: boolean;
} & Record<string, unknown>;

/** Case-insensitive membership check that fails with a typed, listed-choices error. */
export function requireOneOf(value: string, allowed: readonly string[], flag: string, code: string): string {
  const normalized = value.toLowerCase();
  if (allowed.includes(normalized)) return normalized;
  throw new CliActionableError(
    `--${flag} must be one of: ${allowed.join(", ")} (got '${value}').`,
    code,
    `Re-run with --${flag} ${allowed[0]}${allowed.length > 1 ? ` or --${flag} ${allowed[1]}` : ""}.`
  );
}

/** Positional id or --secret-id; callers read the flag themselves so the catalog attributes it to them. */
export function secretIdArg(args: string[], fromFlag: string): string {
  const id = args[0] || fromFlag;
  if (id) return id;
  throw new CliActionableError(
    "A secret id is required.",
    "secret_id_required",
    "Run 'blocks secrets list --json' to find it, then pass it as the first argument or --secret-id <secretId>."
  );
}

/**
 * Resolves a secret VALUE from exactly one of three inputs. The callers read the flags
 * themselves (the command catalog attributes flags to the file that reads them) and
 * hand the raw strings here. A file or an environment variable is preferred over
 * --value, which lands in shell history and process listings. The value only ever
 * travels into the request body; every printed copy of that body is redacted.
 */
export async function secretValueInput(
  input: { envName?: string; file?: string; inline?: string },
  options: { required?: boolean } = {}
): Promise<string | undefined> {
  const given = [
    input.inline ? "--value" : "",
    input.file ? "--value-file" : "",
    input.envName ? "--value-env" : ""
  ].filter(Boolean);
  if (given.length > 1) {
    throw new CliActionableError(
      `Pass only one of ${given.join(", ")}.`,
      "secret_value_ambiguous",
      "Keep a single source for the value."
    );
  }

  if (input.inline) return input.inline;

  if (input.file) {
    try {
      // One trailing newline is an editor artifact, not part of the secret.
      return (await readFile(input.file, "utf8")).replace(/\r?\n$/, "");
    } catch (error) {
      throw new CliActionableError(
        `Could not read the secret value from '${input.file}': ${(error as Error).message}`,
        "secret_value_unreadable",
        "Pass --value-file <path> pointing at a readable file whose whole content is the value."
      );
    }
  }

  if (input.envName) {
    const value = process.env[input.envName];
    if (!value) {
      throw new CliActionableError(
        `Environment variable '${input.envName}' is not set or empty.`,
        "secret_value_env_missing",
        `Export ${input.envName} in the shell that runs the command, then re-run.`
      );
    }
    return value;
  }

  if (options.required) {
    throw new CliActionableError(
      "A secret value is required.",
      "secret_value_required",
      "Pass --value-file <path> or --value-env <NAME> (preferred: keeps the value out of shell history), or --value <text>."
    );
  }
  return undefined;
}

/** blocksRequest surfaces HTTP failures as 'Blocks API <status> ...' errors. */
export function isNotFoundError(error: unknown): boolean {
  return /^Blocks API 404\b/.test((error as Error)?.message ?? "");
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
