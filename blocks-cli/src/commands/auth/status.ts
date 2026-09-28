import { parseFlags, stringFlag } from "../../lib/args.js";
import { readConfig, resolveAccountProfile } from "../../lib/config.js";
import { isExpiring } from "../../lib/token.js";
import { readTokenStore } from "../../lib/token-store.js";
import { writeOutput } from "../../lib/output.js";
import { optionalSelectedProject } from "../../lib/workspace.js";

export async function authStatus(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const config = await readConfig();
  const store = await readTokenStore();
  const accountOverride = stringFlag(flags, "account") || undefined;

  const { name } = await resolveAccountProfile(config, accountOverride);
  const tenantId = await optionalSelectedProject(flags);
  const accountToken = store.accounts[name]?.account;
  const projectToken = tenantId
    ? store.accounts[name]?.projects?.[tenantId]
    : undefined;

  if (flags.json) {
    writeOutput({
      accountAccessToken: tokenState(accountToken?.accessToken, accountToken?.expiresAt),
      accountRefreshToken: tokenState(accountToken?.refreshToken, accountToken?.refreshTokenExpiresAt),
      projectAccessToken: tokenState(projectToken?.accessToken, projectToken?.expiresAt),
      projectRefreshToken: tokenState(projectToken?.refreshToken, projectToken?.refreshTokenExpiresAt)
    }, flags);
    return;
  }

  console.log(`Account access token: ${tokenState(accountToken?.accessToken, accountToken?.expiresAt)}`);
  console.log(`Account refresh token: ${tokenState(accountToken?.refreshToken, accountToken?.refreshTokenExpiresAt)}`);
  console.log(`Project access token: ${tokenState(projectToken?.accessToken, projectToken?.expiresAt)}`);
  console.log(`Project refresh token: ${tokenState(projectToken?.refreshToken, projectToken?.refreshTokenExpiresAt)}`);
}

function tokenState(token?: string, expiresAt?: string): string {
  if (!token) return "missing";
  if (!expiresAt) return "available";
  return isExpiring(expiresAt) ? "expired" : "valid";
}
