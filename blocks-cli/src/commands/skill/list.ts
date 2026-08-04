import { listSkills } from "../../lib/skills.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";

export async function skillList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const skills = await listSkills();

  if (flags.json) {
    writeOutput(skills, flags);
    return;
  }

  for (const skill of skills) {
    console.log(`${skill.name}  ${skill.description}`);
  }
}
