import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { publishWorkflow, resolveWorkflowIdOrFile } from "../../lib/logic-push.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Make a draft workflow live. Accepts a workflowId or a local file path whose
 * workflowId is recorded in blocks.json. With --version-name, publishes a named
 * new version; otherwise publishes the current draft via PublishVersion.
 */
export async function logicPublish(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const target = args[0];
  if (!target) {
    throw new CliActionableError(
      "Missing workflow id or file path.",
      "logic_bad_shape",
      "Usage: blocks logic publish <workflow-id-or-file> [--version-name <string>] [--dry-run] [--yes] [--json]"
    );
  }

  const versionName = stringFlag(flags, "version-name") || undefined;
  const dryRun = booleanFlag(flags, "dry-run");
  const { workflowId, fromFile } = await resolveWorkflowIdOrFile(target);
  const projectKey = await selectedProject(flags);

  if (dryRun) {
    writeOutput(
      {
        dryRun: true,
        workflowId,
        ...(fromFile ? { file: fromFile } : {}),
        ...(versionName
          ? { endpoint: "/logic/v4/Workflow/PublishNewVersion", versionName }
          : { endpoint: "/logic/v4/Workflow/PublishVersion" })
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    `Publish workflow '${workflowId}'${versionName ? ` as version '${versionName}'` : ""}. It will start running.`
  );

  const result = await publishWorkflow({
    workflowId,
    projectKey,
    flags,
    versionName
  });

  writeOutput(
    {
      workflowId: result.workflowId,
      published: true,
      ...(result.versionId ? { versionId: result.versionId } : {})
    },
    flags
  );
}
