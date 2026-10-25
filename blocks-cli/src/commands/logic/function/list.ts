import { stringFlag } from "../../../lib/args.js";
import {
  FUNCTION_STATUSES,
  listFunctions,
  parseFunctionPaging,
  pickOne
} from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** List functions (summaries -- never the source) from Functions/GetAll. */
export async function logicFunctionList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const { page, pageSize } = parseFunctionPaging(flags, 20);
  const statusRaw = stringFlag(flags, "status");
  const sortRaw = stringFlag(flags, "sort");
  const projectKey = await selectedProject(flags);
  const result = await listFunctions({
    projectKey,
    flags,
    search: stringFlag(flags, "search") || undefined,
    status: statusRaw ? pickOne(statusRaw, FUNCTION_STATUSES, "status", "FUNCTION_VALIDATION") : undefined,
    sortBy: sortRaw ? pickOne(sortRaw, ["Name", "Updated"], "sort", "FUNCTION_VALIDATION") : undefined,
    page,
    pageSize
  });
  writeOutput(result, flags);
}
