import { readSkill } from "../../lib/skills.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";

export async function skillShow(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0];
  if (!name) throw new Error("Missing skill name. Run 'blocks skill list' to see available skills.");

  const skill = await readSkill(name);

  if (flags.json) {
    writeOutput(skill, flags);
    return;
  }

  console.log(skill.content);
}
