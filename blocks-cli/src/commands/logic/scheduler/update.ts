import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import {
  buildUpdateOverrides,
  LOGIC_SCHEDULER_API,
  readSchedulerFile,
  redactSchedulerSecrets,
  updateSchedule
} from "../../../lib/logic-scheduler.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function logicSchedulerUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const scheduleId = args[0];
  if (!scheduleId) {
    throw new CliActionableError(
      "Missing schedule id.",
      "scheduler_id_required",
      "Usage: blocks logic scheduler update <schedule-id> [flags] [--yes] [--json]"
    );
  }

  const filePath = stringFlag(flags, "file") || undefined;
  const overrides = filePath ? {} : buildUpdateOverrides(flags, argv);
  const replaceBody = filePath ? await readSchedulerFile(filePath) : undefined;

  if (!filePath && Object.keys(overrides).length === 0) {
    throw new CliActionableError(
      "Provide at least one field to update (--name/--cron/--url/--active/--inactive/… or --file).",
      "scheduler_update_empty"
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint: `${LOGIC_SCHEDULER_API}/UpdateSchedule`,
        scheduleId,
        request: redactSchedulerSecrets(replaceBody ?? overrides)
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Update logic schedule '${scheduleId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await updateSchedule({
    projectKey,
    flags,
    scheduleId,
    overrides,
    replaceBody
  });
  writeOutput(redactSchedulerSecrets(result), flags);
}
