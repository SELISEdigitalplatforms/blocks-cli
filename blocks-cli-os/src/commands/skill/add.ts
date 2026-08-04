import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringFlag } from "../../lib/args.js";
import { readSkill } from "../../lib/skills.js";
import { parseCommand } from "../../lib/workspace.js";

export async function skillAdd(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0];
  if (!name) throw new Error("Missing skill name. Run 'blocks-os skill:list' to see available skills.");

  const skill = await readSkill(name);
  const targetDir = stringFlag(flags, "dir", { defaultValue: "blocks-skills" });
  const targetPath = join(process.cwd(), targetDir, name, "SKILL.md");

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, skill.content);

  console.log(`Added ${targetPath}`);
}
