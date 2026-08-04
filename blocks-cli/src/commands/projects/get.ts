import { booleanFlag } from "../../lib/args.js";
import { writeOutput } from "../../lib/output.js";
import { findProjectByTenantId, getProjectAssets } from "../../lib/project-info.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function getProject(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const tenantId = args[0] || await selectedProject(flags);
  const { group, project } = await findProjectByTenantId(tenantId, flags);

  if (!booleanFlag(flags, "deployment") || !group.tenantGroupId) {
    writeOutput({ group, project }, flags);
    return;
  }

  const assets = await getProjectAssets(group.tenantGroupId, flags);
  writeOutput(
    {
      deployment: {
        environment: project.environment,
        repos: assets.assets?.resources ?? [],
        tenantGroupId: group.tenantGroupId
      },
      group,
      project
    },
    flags
  );
}
