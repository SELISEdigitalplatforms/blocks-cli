import { stringFlag } from "../lib/args.js";
import { stopProjectImpersonation } from "../lib/auth.js";
import { readConfig, resolveAccountProfile } from "../lib/config.js";
import { writeOutput } from "../lib/output.js";
import { clearSelectedProject, optionalSelectedProject, parseCommand } from "../lib/workspace.js";

export async function deselectProject(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const accountOverride = stringFlag(flags, "account") || undefined;
  const { name: accountName } = await resolveAccountProfile(await readConfig(), accountOverride);
  const tenantId = await optionalSelectedProject(flags);

  if (!tenantId) {
    if (flags.json) writeOutput({ account: accountName, deselected: false, tenantId: null }, flags);
    else console.log("No project is currently selected.");
    return;
  }

  // Stop-impersonation restores a fresh account refresh token and drops the
  // project's cached token from the store, so there's nothing left to clean
  // up here beyond the selection itself.
  await stopProjectImpersonation(accountName, tenantId);
  await clearSelectedProject(accountName);

  if (flags.json) {
    writeOutput({ account: accountName, accountSessionRestored: true, deselected: true, tenantId }, flags);
  } else {
    console.log(`Deselected project tenant ${tenantId}. Account session restored.`);
    console.log("Run 'blocks use <tenantId>' to select a project again.");
  }
}
