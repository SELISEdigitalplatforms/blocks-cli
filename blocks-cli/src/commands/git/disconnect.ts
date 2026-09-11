import { confirmMutation } from "../../lib/confirm.js";
import { clearRepoBinding, readRepoBinding, requireRepoBinding } from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";

/**
 * Scenario F — forget the connected repository. Removes only the `repo`
 * entry from blocks.json; `.git`, its remotes and every commit stay exactly
 * as they were, and nothing is touched on GitHub. Undo is `blocks git connect`.
 */
export async function gitDisconnect(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const binding = requireRepoBinding(await readRepoBinding());
  await confirmMutation(flags, `Disconnect this workspace from ${binding.fullName}. The local git history and the GitHub repository are left untouched.`);
  await clearRepoBinding();
  writeOutput({ disconnected: true, repo: binding }, flags);
}
