import { normalizeAccountName, readConfig } from "../lib/config.js";
import { readTokenStore, writeTokenStore } from "../lib/token-store.js";
import { requestContext } from "../lib/request-context.js";
import { clearSelectedProject, parseCommand } from "../lib/workspace.js";

export async function deselectProject(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const config = await readConfig();
  const { accountName } = requestContext(flags);
  const account = normalizeAccountName(accountName ?? config.activeAccount);

  const tenantId = await clearSelectedProject();
  if (!tenantId) {
    console.log("No project is currently selected.");
    return;
  }

  const store = await readTokenStore();
  const projects = store.accounts[account]?.projects;
  if (projects && tenantId in projects) {
    const { [tenantId]: _removed, ...remainingProjects } = projects;
    await writeTokenStore({
      accounts: {
        ...store.accounts,
        [account]: {
          ...store.accounts[account],
          projects: remainingProjects
        }
      }
    });
  }

  console.log(`Deselected project tenant ${tenantId}.`);
  console.log("Run 'blocks-os use <tenantId>' to select a project again.");
}
