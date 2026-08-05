import { stringFlag } from "../lib/args.js";
import { getImpersonatedProjectSession, stopProjectImpersonation } from "../lib/auth.js";
import { readConfig } from "../lib/config.js";
import { parseCommand, saveSelectedProject } from "../lib/workspace.js";

export async function useProject(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const tenantId = args[0];
  if (!tenantId) throw new Error("Missing project tenant id.");

  const accountName = stringFlag(flags, "account") || undefined;
  const config = await readConfig();
  const previousTenantId = config.selectedProject?.tenantId;

  if (previousTenantId && previousTenantId !== tenantId) {
    // Switching projects needs a fresh account refresh token to start the new
    // impersonation -- the one used to start the old impersonation was
    // already consumed by the server, so the old session must be stopped
    // first to get a new one back.
    await stopProjectImpersonation(accountName, previousTenantId);
  }

  await saveSelectedProject(tenantId);
  const project = await getImpersonatedProjectSession(accountName, tenantId);

  console.log(`Selected project tenant ${tenantId}`);
  console.log(`Project session ready for tenant ${project.tenantId}.`);
}
