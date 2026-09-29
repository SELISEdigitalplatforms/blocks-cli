import { CliActionableError } from "../../lib/errors.js";
import { getWorkflowRecord } from "../../lib/logic-push.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Fetch one workflow from blocks-logic (Workflow/Get), returned verbatim.
 */
export async function logicGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const workflowId = args[0];
  if (!workflowId) {
    throw new CliActionableError(
      "Missing workflow id.",
      "logic_bad_shape",
      "Usage: blocks logic get <workflow-id> [--json]"
    );
  }

  const projectKey = await selectedProject(flags);
  const result = await getWorkflowRecord({ workflowId, projectKey, flags });
  writeOutput(result, flags);
}
