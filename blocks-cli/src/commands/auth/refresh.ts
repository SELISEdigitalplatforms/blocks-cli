import { parseFlags, stringFlag } from "../../lib/args.js";
import { getAccountSession, getImpersonatedProjectSession } from "../../lib/auth.js";
import { readConfig } from "../../lib/config.js";
import { readTokenStore } from "../../lib/token-store.js";

export async function authRefresh(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountName = stringFlag(flags, "account");
  const project = Boolean(flags.project);
  const config = await readConfig();
  const store = await readTokenStore();

  const account = await getAccountSession(accountName);
  console.log(`Account '${account.account}' session ready for tenant ${account.accountTenant}`);

  if (!project) return;

  if (!config.selectedProject?.tenantId) {
    throw new Error("No project selected. Run `blocks-os use <tenantId>` first.");
  }

  const projectToken = store.accounts[account.account]?.projects?.[config.selectedProject.tenantId];
  if (!projectToken?.refreshToken && !projectToken?.accessToken) {
    throw new Error("No project session exists yet. A service command must create impersonation first.");
  }

  const projectSession = await getImpersonatedProjectSession(account.account);
  console.log(`Project session ready for tenant ${projectSession.tenantId}`);
}
