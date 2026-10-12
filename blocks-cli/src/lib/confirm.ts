import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { booleanFlag } from "./args.js";
import { CliActionableError } from "./errors.js";
import { isInteractive } from "./prompt.js";

/**
 * Gate in front of every mutation. Commands handle --dry-run themselves and return a
 * plan before getting here, so reaching this point under --dry-run means the command
 * is about to mutate during a preview. That used to count as approval (`new web
 * --dry-run` scaffolded the app and switched OIDC on for the tenant); now it stops.
 */
export async function confirmMutation(flags: Record<string, string | boolean>, message: string): Promise<void> {
  if (booleanFlag(flags, "dry-run")) {
    throw new CliActionableError(
      `Refusing to run a mutation under --dry-run: ${message}`,
      "dry_run_would_mutate",
      "This command has no dry-run preview for this step. Nothing was changed by this step; re-run without --dry-run (with --yes after approval) to apply it."
    );
  }
  if (booleanFlag(flags, "yes")) return;
  if (!isInteractive()) {
    throw new Error("Confirmation required in non-interactive mode. Review with --dry-run when supported, then re-run with --yes after explicit approval.");
  }

  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${message} Type 'yes' to continue: `)).trim().toLowerCase();
    if (answer !== "yes") throw new Error("Cancelled.");
  } finally {
    rl.close();
  }
}
