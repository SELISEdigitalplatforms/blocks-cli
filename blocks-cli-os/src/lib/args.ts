export function parseFlags(argv: string[]): { args: string[]; flags: Record<string, string | boolean> } {
  const args: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("--")) {
      args.push(value);
      continue;
    }

    const [rawName, inlineValue] = value.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawName] = inlineValue;
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawName] = next;
      index += 1;
      continue;
    }

    flags[rawName] = true;
  }

  return { args, flags };
}

export function stringFlag(
  flags: Record<string, string | boolean>,
  name: string,
  options: { defaultValue?: string; env?: string; required?: boolean } = {}
): string {
  const value = flags[name] ?? (options.env ? process.env[options.env] : undefined) ?? options.defaultValue;
  if (typeof value === "string" && value) return value;
  if (options.required) throw new Error(`Missing --${name}`);
  return "";
}

export function integerFlag(
  flags: Record<string, string | boolean>,
  name: string,
  defaultValue: number
): number {
  const value = flags[name];
  if (value === undefined || value === true) return defaultValue;

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new Error(`--${name} must be an integer`);
  return parsed;
}

export function booleanFlag(flags: Record<string, string | boolean>, name: string): boolean {
  return flags[name] === true || flags[name] === "true";
}
