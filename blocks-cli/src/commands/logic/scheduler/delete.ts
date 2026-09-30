import { booleanFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { deleteSchedule, LOGIC_SCHEDULER_API } from "../../../lib/logic-scheduler.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function logicSchedulerDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const scheduleId = args[0];
  if (!scheduleId) {
    throw new CliActionableError(
      "Missing schedule id.",
      "scheduler_id_required",
      "Usage: blocks logic scheduler delete <schedule-id> --yes [--json]"
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${LOGIC_SCHEDULER_API}/DeleteSchedule`, scheduleId }, flags);
    return;
  }

  await confirmMutation(flags, `Delete logic schedule '${scheduleId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await deleteSchedule({ projectKey, flags, scheduleId });
  writeOutput(result, flags);
}
