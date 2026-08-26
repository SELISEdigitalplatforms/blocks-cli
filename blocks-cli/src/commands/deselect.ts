import { stringFlag } from "../lib/args.js";
import { stopProjectImpersonation } from "../lib/auth.js";
import { clearSelectedProject, optionalSelectedProject, parseCommand } from "../lib/workspace.js";

export async function deselectProject(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const accountName = stringFlag(flags, "account") || undefined;
  const tenantId = await optionalSelectedProject(flags);

  if (!tenantId) {
    console.log("No project is currently selected.");
    return;
  }

  // Stop-impersonation restores a fresh account refresh token and drops the
  // project's cached token from the store, so there's nothing left to clean
  // up here beyond the selection itself.
  await stopProjectImpersonation(accountName, tenantId);
  await clearSelectedProject(accountName);

  console.log(`Deselected project tenant ${tenantId}. Account session restored.`);
  console.log("Run 'blocks use <tenantId>' to select a project again.");
}
