import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { booleanFlag } from "./args.js";

export async function confirmMutation(flags: Record<string, string | boolean>, message: string): Promise<void> {
  if (booleanFlag(flags, "yes") || booleanFlag(flags, "dry-run")) return;

  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(`${message} Type 'yes' to continue: `)).trim().toLowerCase();
    if (answer !== "yes") throw new Error("Cancelled.");
  } finally {
    rl.close();
  }
}
