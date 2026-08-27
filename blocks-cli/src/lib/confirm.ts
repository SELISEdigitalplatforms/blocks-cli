import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { booleanFlag } from "./args.js";
import { isInteractive } from "./prompt.js";

export async function confirmMutation(flags: Record<string, string | boolean>, message: string): Promise<void> {
  if (booleanFlag(flags, "yes") || booleanFlag(flags, "dry-run")) return;
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
