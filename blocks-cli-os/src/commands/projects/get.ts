import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

type ProjectGroup = {
  projects?: Array<{ tenantId?: string } & Record<string, unknown>>;
} & Record<string, unknown>;

export async function getProject(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const tenantId = args[0] || await selectedProject(flags);
  const groups = await blocksRequest<ProjectGroup[]>("/os/v4/Project/Gets", {
    accountAuth: true,
    ...requestContext(flags),
    query: { page: 0, pageSize: 100, tenantGroupId: "" }
  });

  for (const group of groups) {
    const project = (group.projects ?? []).find((item) => item.tenantId === tenantId);
    if (project) {
      writeOutput({ group, project }, flags);
      return;
    }
  }

  throw new Error(`Project '${tenantId}' was not found in Project/Gets.`);
}
