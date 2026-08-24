import { parseFlags, stringFlag } from "../../lib/args.js";
import { getAccountSession, getImpersonatedProjectSession } from "../../lib/auth.js";
import { readConfig } from "../../lib/config.js";
import { readTokenStore } from "../../lib/token-store.js";
import { writeOutput } from "../../lib/output.js";

export async function authRefresh(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountName = stringFlag(flags, "account");
  const project = Boolean(flags.project);
  const config = await readConfig();
  const store = await readTokenStore();

  const account = await getAccountSession(accountName);

  if (!project) {
    // --json has to produce JSON on success too, not just on the error path, or an
    // agent that asked for machine-readable output gets a prose line to parse.
    if (flags.json) {
      writeOutput({ account: account.account, accountTenant: account.accountTenant, refreshed: "account" }, flags);
    } else {
      console.log(`Account '${account.account}' session ready for tenant ${account.accountTenant}`);
    }
    return;
  }

  if (!config.selectedProject?.tenantId) {
    throw new Error("No project selected. Run `blocks use <tenantId>` first.");
  }

  const projectToken = store.accounts[account.account]?.projects?.[config.selectedProject.tenantId];
  if (!projectToken?.refreshToken && !projectToken?.accessToken) {
    throw new Error("No project session exists yet. A service command must create impersonation first.");
  }

  const projectSession = await getImpersonatedProjectSession(account.account);
  if (flags.json) {
    writeOutput(
      {
        account: account.account,
        accountTenant: account.accountTenant,
        projectTenantId: projectSession.tenantId,
        refreshed: "account+project"
      },
      flags
    );
    return;
  }

  console.log(`Account '${account.account}' session ready for tenant ${account.accountTenant}`);
  console.log(`Project session ready for tenant ${projectSession.tenantId}`);
}
