import { CommandEntry, commandCatalog } from "./command-catalog.js";

const GLOBAL_ALWAYS = ["--json", "--account <name>", "--project <tenantId>", "--api-url <url>"];
const GLOBAL_MUTATING = ["--dry-run", "--yes"];

const SCOPE_NOTE: Record<CommandEntry["scope"], string> = {
  account: "Account-scoped: uses the account token. Stops and restores an active project session.",
  local: "Local: touches no Blocks API.",
  project: "Project-scoped: needs a selected project (or --project) and an impersonated project token.",
  "project-or-account": "Prefers the impersonated project token when a project resolves, otherwise the account token."
};

/**
 * Flags every command accepts. `parseFlags` has no schema, so anything not
 * listed here or in a command's own catalog entry is a flag the command will
 * never read.
 */
const GLOBAL_FLAG_NAMES = new Set(["json", "api-url", "account", "project", "dry-run", "yes", "help", "h"]);

export function findCommand(name: string): CommandEntry | undefined {
  return commandCatalog.find((entry) => entry.name === name);
}

/**
 * Flags passed to a command that the command does not read.
 *
 * `parseFlags` collects any `--token` it sees, and each command then picks out
 * only the names it knows, so a typo (`--hostt` for `--host`) used to vanish
 * without a trace: the dry-run looked clean, the field was simply absent, and
 * the mutation went out missing a value after a human approved what they saw.
 * The catalog's flag list is derived from each command's own source, so it is
 * the authoritative answer to "would this command ever read that flag".
 */
export function unknownFlags(entry: CommandEntry, argv: readonly string[]): string[] {
  const known = new Set([...entry.flags, ...GLOBAL_FLAG_NAMES]);
  const unknown: string[] = [];

  for (const token of argv) {
    if (!token.startsWith("--") || token === "--") continue;
    const name = token.slice(2).split("=", 1)[0];
    if (!name || known.has(name) || unknown.includes(name)) continue;
    unknown.push(name);
  }

  return unknown;
}

export function unknownFlagMessage(entry: CommandEntry, unknown: string[]): string {
  const listed = unknown.map((name) => `--${name}`).join(", ");
  const plural = unknown.length === 1 ? "flag" : "flags";
  return `${listed} ${unknown.length === 1 ? "is not a" : "are not"} ${plural} `
    + `'blocks ${entry.name}' reads, so ${unknown.length === 1 ? "its value is" : "their values are"} ignored. `
    + `Run 'blocks help ${entry.name}' for the flags it accepts.`;
}

export function findFamily(name: string): CommandEntry[] {
  return commandCatalog.filter((entry) => entry.name === name || entry.name.startsWith(`${name} `));
}

export function usageOf(entry: CommandEntry): string {
  const parts = [`blocks ${entry.name}`];
  if (entry.positional) parts.push(entry.positional);
  for (const flag of entry.flags) parts.push(`[--${flag}]`);
  for (const flag of GLOBAL_ALWAYS) parts.push(`[${flag}]`);
  if (entry.mutating) for (const flag of GLOBAL_MUTATING) parts.push(`[${flag}]`);
  return parts.join(" ");
}

/**
 * Compact machine-readable index -- the cheap alternative to the full text
 * help. Deliberately carries names only, not summaries: names are descriptive
 * enough to pick a family, and 'blocks help <family>' then costs a few hundred
 * tokens instead of the ~12k the full text help costs.
 */
export function renderIndex(): string {
  const families: Record<string, string[]> = {};
  for (const entry of commandCatalog) {
    (families[entry.family] ??= []).push(entry.name);
  }

  return JSON.stringify({
    commandCount: commandCatalog.length,
    families,
    globalOptions: [...GLOBAL_ALWAYS, ...GLOBAL_MUTATING],
    mutating: commandCatalog.filter((entry) => entry.mutating).map((entry) => entry.name),
    note: "Run 'blocks help <family>' for summaries, or 'blocks help <command>' for flags. Commands under 'mutating' support --dry-run/--yes."
  });
}

export function renderCommand(entry: CommandEntry, asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(
      {
        details: entry.details,
        flags: entry.flags,
        globalOptions: entry.mutating ? [...GLOBAL_ALWAYS, ...GLOBAL_MUTATING] : GLOBAL_ALWAYS,
        mutating: entry.mutating,
        name: entry.name,
        positional: entry.positional,
        scope: entry.scope,
        scopeNote: SCOPE_NOTE[entry.scope],
        summary: entry.summary,
        usage: usageOf(entry)
      },
      null,
      2
    );
  }

  const lines = [usageOf(entry), "", `  ${entry.summary}`];
  if (entry.details && entry.details !== entry.summary) lines.push("", `  ${entry.details}`);
  lines.push("", `  ${SCOPE_NOTE[entry.scope]}`);
  if (entry.mutating) lines.push("  Mutating: use --dry-run first, then --yes only after explicit approval.");
  return lines.join("\n");
}

export function renderFamily(name: string, entries: CommandEntry[], asJson: boolean): string {
  if (asJson) {
    return JSON.stringify(
      {
        commands: entries.map((entry) => ({
          mutating: entry.mutating,
          name: entry.name,
          scope: entry.scope,
          summary: entry.summary,
          usage: usageOf(entry)
        })),
        family: name
      },
      null,
      2
    );
  }

  const width = Math.max(...entries.map((entry) => entry.name.length));
  return [
    `blocks ${name} -- ${entries.length} command(s)`,
    "",
    ...entries.map((entry) => `  ${entry.name.padEnd(width)}  ${entry.mutating ? "!" : " "} ${entry.summary}`),
    "",
    "  ! = mutating (supports --dry-run/--yes)",
    "  Run 'blocks help <command>' for one command's flags."
  ].join("\n");
}

/**
 * Resolves the longest catalog match in `words`, so 'help data schema push'
 * finds the command and 'help data schema' finds the family.
 */
export function resolveHelpTarget(words: string[]): { entries: CommandEntry[]; exact?: CommandEntry; name: string } | undefined {
  for (let length = words.length; length > 0; length -= 1) {
    const name = words.slice(0, length).join(" ");
    const exact = findCommand(name);
    if (exact) return { entries: [exact], exact, name };
    const entries = findFamily(name);
    if (entries.length > 0) return { entries, name };
  }
  return undefined;
}
