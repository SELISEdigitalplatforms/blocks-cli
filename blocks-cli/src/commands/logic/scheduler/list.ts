import { stringFlag } from "../../../lib/args.js";
import { listSchedules, parseSchedulerPaging } from "../../../lib/logic-scheduler.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function logicSchedulerList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const { page, pageSize } = parseSchedulerPaging(flags);
  const result = await listSchedules({
    projectKey,
    flags,
    search: stringFlag(flags, "search") || undefined,
    page,
    pageSize
  });
  writeOutput(result, flags);
}
