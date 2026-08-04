import { cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringFlag } from "../../lib/args.js";
import { readSkill } from "../../lib/skills.js";
import { parseCommand } from "../../lib/workspace.js";

export async function skillAdd(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0];
  if (!name) throw new Error("Missing skill name. Run 'blocks skill list' to see available skills.");

  const skill = await readSkill(name);
  const sourceDir = dirname(skill.path);
  const targetDir = stringFlag(flags, "dir", { defaultValue: "blocks-skills" });
  const targetPath = join(process.cwd(), targetDir, name);

  // Copy the whole skill directory, not just SKILL.md -- some skills also ship
  // supporting files (e.g. flows/*.md) that SKILL.md links to.
  await cp(sourceDir, targetPath, { recursive: true });

  console.log(`Added ${targetPath}`);
}
