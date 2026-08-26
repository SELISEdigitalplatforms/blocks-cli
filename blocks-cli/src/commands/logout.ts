import { parseFlags, stringFlag } from "../lib/args.js";
import { logoutCurrentSession } from "../lib/auth.js";
import { optionalSelectedProject } from "../lib/workspace.js";

export async function logout(argv: string[] = []): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountOverride = stringFlag(flags, "account") || undefined;
  const tenantId = await optionalSelectedProject(flags);
  const result = await logoutCurrentSession(accountOverride, tenantId);
  if (result.warning) console.warn(`Warning: ${result.warning}`);

  if (result.hadTokens) {
    console.log(`Logged out${accountOverride ? ` account '${accountOverride}'` : ""}.`);
    return;
  }

  console.log("No active login tokens found.");
}
