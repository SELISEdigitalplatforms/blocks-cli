import { parseFlags, stringFlag } from "../../lib/args.js";
import { getAccountSession, getImpersonatedProjectSession, withAccountMode } from "../../lib/auth.js";
import { readConfig, resolveAccountProfile } from "../../lib/config.js";
import { writeOutput } from "../../lib/output.js";
import { selectedProject } from "../../lib/workspace.js";

export async function authRefresh(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountName = stringFlag(flags, "account") || undefined;
  const refreshProject = flags.project !== undefined;
  const config = await readConfig();
  const { name } = await resolveAccountProfile(config, accountName);

  if (!refreshProject) {
    const transition = await withAccountMode(name, (account) =>
      getAccountSession(account.account, { forceRefresh: true })
    );
    const account = transition.result;
    if (flags.json) {
      writeOutput({
        account: account.account,
        accountTenant: account.accountTenant,
        projectTenantId: transition.previousProject,
        refreshed: transition.previousProject ? "account+project" : "account",
        restored: !transition.restoreError
      }, flags);
    } else {
      console.log(`Account '${account.account}' session ready for tenant ${account.accountTenant}`);
      if (transition.previousProject && !transition.restoreError) {
        console.log(`Project session restored for tenant ${transition.previousProject}`);
      }
    }
    if (transition.restoreError) console.warn(`Warning: account refreshed, but project '${transition.previousProject}' could not be restored: ${transition.restoreError.message}`);
    return;
  }

  const explicitTenantId = stringFlag(flags, "project");
  const tenantId = explicitTenantId || await selectedProject({ ...flags, project: false });

  const projectSession = await getImpersonatedProjectSession(name, tenantId, { forceRefresh: true });
  if (flags.json) {
    writeOutput(
      {
        account: projectSession.account,
        accountTenant: projectSession.accountTenant,
        projectTenantId: projectSession.tenantId,
        refreshed: "project"
      },
      flags
    );
    return;
  }

  console.log(`Project session ready for tenant ${projectSession.tenantId}`);
}
