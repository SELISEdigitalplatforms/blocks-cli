import { stringFlag } from "./args.js";

export function requestContext(flags: Record<string, string | boolean>): { accountName?: string; apiUrl?: string } {
  const accountName = stringFlag(flags, "account") || undefined;
  const apiUrl = stringFlag(flags, "api-url") || undefined;

  return {
    accountName,
    apiUrl
  };
}
