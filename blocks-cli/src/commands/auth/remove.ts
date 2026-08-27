import { parseFlags } from "../../lib/args.js";
import { normalizeAccountName, readConfig, writeConfig } from "../../lib/config.js";
import { removeAccountSecrets } from "../../lib/secret-store.js";
import { removeAccountTokens } from "../../lib/token-store.js";
import { writeOutput } from "../../lib/output.js";

export async function authRemove(argv: string[]): Promise<void> {
  const { args, flags } = parseFlags(argv);
  const account = normalizeAccountName(args[0]);
  const config = await readConfig();

  if (!config.accounts[account]) {
    throw new Error(`OIDC account '${account}' is not configured.`);
  }

  const { [account]: _, ...accounts } = config.accounts;
  const nextActive = config.activeAccount === account ? Object.keys(accounts)[0] : config.activeAccount;

  await writeConfig({
    ...config,
    activeAccount: nextActive,
    accounts
  });
  await removeAccountSecrets(account);
  await removeAccountTokens(account);

  if (flags.json) writeOutput({ account, activeAccount: nextActive ?? null, removed: true }, flags);
  else console.log(`Removed OIDC account '${account}'.`);
}
