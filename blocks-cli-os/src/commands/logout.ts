import { parseFlags, stringFlag } from "../lib/args.js";
import { revokeCurrentSession } from "../lib/auth.js";
import { readConfig } from "../lib/config.js";
import { readTokenStore, removeAccountTokens } from "../lib/token-store.js";

export async function logout(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const account = stringFlag(flags, "account");

  try {
    await revokeCurrentSession(account);
  } catch (error) {
    console.warn(`Warning: ${(error as Error).message}`);
  }

  const config = await readConfig();
  const store = await readTokenStore();
  const accountName = account || config.activeAccount;
  if (accountName && store.accounts[accountName]) {
    await removeAccountTokens(accountName);
    console.log(`Logged out account '${accountName}'.`);
    return;
  }

  console.log("No active login tokens found.");
}
