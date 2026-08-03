import { blocksRequest } from "../../lib/api.js";
import { parseCommand } from "../../lib/workspace.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";

type ProjectGroup = {
  name?: string;
  projects?: Array<{
    applications?: Array<{ domain?: string }>;
    environment?: string;
    name?: string;
    tenantId?: string;
  }>;
  tenantGroupId?: string;
};

export async function listProjects(argv: string[] = []): Promise<void> {
  const { flags } = parseCommand(argv);
  const groups = await blocksRequest<ProjectGroup[]>("/os/v4/Project/Gets", {
    accountAuth: true,
    ...requestContext(flags),
    query: { page: 0, pageSize: 100, tenantGroupId: "" }
  });

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
