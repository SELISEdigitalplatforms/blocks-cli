import { stringFlag } from "./args.js";

export function requestContext(flags: Record<string, string | boolean>): { accountName?: string; apiUrl?: string } {
  const accountName = stringFlag(flags, "account") || undefined;
  const apiUrl = stringFlag(flags, "api-url") || undefined;

  return {
    accountName,
    apiUrl
  };
}

export function commandContextArgs(flags: Record<string, string | boolean>): string[] {
  const args: string[] = [];
  for (const name of ["account", "project", "api-url"]) {
    const value = stringFlag(flags, name);
    if (value) args.push(`--${name}`, value);
  }
  return args;
}
