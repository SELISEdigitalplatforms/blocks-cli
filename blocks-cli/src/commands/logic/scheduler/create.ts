import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import {
  buildCreateBodyFromFlags,
  createSchedule,
  LOGIC_SCHEDULER_API,
  readSchedulerFile,
  redactSchedulerSecrets
} from "../../../lib/logic-scheduler.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function logicSchedulerCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const filePath = stringFlag(flags, "file") || undefined;
  const body = filePath ? await readSchedulerFile(filePath) : buildCreateBodyFromFlags(flags, argv);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${LOGIC_SCHEDULER_API}/CreateSchedule`, request: redactSchedulerSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Create logic schedule '${String(body.name ?? "(from file)")}'.`);
  const projectKey = await selectedProject(flags);
  const result = await createSchedule({ projectKey, flags, body });
  writeOutput(redactSchedulerSecrets(result), flags);
}
