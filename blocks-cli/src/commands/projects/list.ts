import { listProjectGroups } from "../../lib/project-info.js";
import { parseCommand } from "../../lib/workspace.js";
import { writeOutput } from "../../lib/output.js";

export async function listProjects(argv: string[] = []): Promise<void> {
  const { flags } = parseCommand(argv);
  const groups = await listProjectGroups(flags);

  if (flags.json) {
    writeOutput(groups, flags);
    return;
  }

  for (const group of groups) {
    for (const project of group.projects ?? []) {
      const domain = project.applications?.[0]?.domain ?? "";
      console.log([
        project.tenantId ?? "-",
        project.name ?? group.name ?? "-",
        project.environment ?? "-",
        domain
      ].join("  "));
    }
  }
}
