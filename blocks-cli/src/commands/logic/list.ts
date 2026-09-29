import { booleanFlag, integerFlag } from "../../lib/args.js";
import { listWorkflows } from "../../lib/logic-push.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * List workflows from blocks-logic (Workflow/GetAll), returned verbatim.
 */
export async function logicList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const search = typeof flags.search === "string" ? flags.search : "";
  const publishedOnly = booleanFlag(flags, "published-only");
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  const pageSize = integerFlag(flags, "page-size", 20);

  const result = await listWorkflows({
    projectKey,
    flags,
    search: search || undefined,
    publishedOnly: publishedOnly || undefined,
    pageNumber: page - 1,
    pageSize
  });
  writeOutput(result, flags);
}
