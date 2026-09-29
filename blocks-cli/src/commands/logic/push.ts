import { basename } from "node:path";
import { booleanFlag, integerFlag, optionalBooleanFlag } from "../../lib/args.js";
import { CliActionableError } from "../../lib/errors.js";
import { compileWorkflowFileText, parseWorkflowSource } from "../../lib/logic-compiler.js";
import { needsLogicRuntimeConfig } from "../../lib/logic-catalog.js";
import {
  getExistingWorkflowBinding,
  pollImportNotification,
  readWorkflowFile,
  recordWorkflowBinding,
  resolveProjectShortKey,
  updateWorkflow,
  uploadAndImportWorkflow,
  workflowBindingKey
} from "../../lib/logic-push.js";
import { resolveLogicRuntimeConfig } from "../../lib/logic-runtime-config.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Compile a YAML (or JSON) workflow file and create or update it in blocks-logic.
 * First push goes through Import; a re-push of a file recorded in blocks.json
 * calls Workflow/Update synchronously.
 */
export async function logicPush(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const filePath = args[0];
  if (!filePath) {
    throw new CliActionableError(
      "Missing workflow file path.",
      "logic_bad_shape",
      "Usage: blocks logic push <file> [--dry-run] [--wait|--no-wait] [--timeout <seconds>]"
    );
  }

  const dryRun = booleanFlag(flags, "dry-run");
  const noWait = flags["no-wait"] === true || flags["no-wait"] === "true";
  const waitFlag = optionalBooleanFlag(flags, "wait");
  const wait = noWait ? false : waitFlag === undefined ? true : waitFlag;
  const timeoutSeconds = integerFlag(flags, "timeout", 60);
  const pollIntervalSeconds = integerFlag(flags, "poll-interval", 3);
  const progress = (message: string): void => (flags.json ? console.error(message) : console.log(message));

  const existing = await getExistingWorkflowBinding(filePath);

  const text = await readWorkflowFile(filePath);
  const peeked = parseWorkflowSource(text);
  const peekedTypes = collectTypes(peeked);
  const need = needsLogicRuntimeConfig(peekedTypes);

  let fixupCtx: { agentsBaseUrl?: string; dataBaseUrl?: string; projectShortKey?: string } = {};
  if (need.agents || need.data) {
    const runtime = await resolveLogicRuntimeConfig(flags, need);
    const projectKey = await selectedProject(flags);
    const projectShortKey = need.data ? await resolveProjectShortKey(projectKey, flags) : undefined;
    fixupCtx = {
      agentsBaseUrl: runtime.agentsBaseUrl,
      dataBaseUrl: runtime.dataBaseUrl,
      projectShortKey
    };
  }

  const { compiled, messageCoRelationId } = compileWorkflowFileText(text, fixupCtx);

  if (dryRun) {
    writeOutput(
      {
        dryRun: true,
        ...(existing ? { workflowId: existing, updated: true } : {}),
        compiled
      },
      flags
    );
    return;
  }

  const projectKey = await selectedProject(flags);
  const rebound = await getExistingWorkflowBinding(filePath);

  if (rebound) {
    await updateWorkflow({
      workflowId: rebound,
      compiled,
      projectKey,
      flags
    });
    writeOutput(
      {
        workflowId: rebound,
        name: compiled.name,
        updated: true
      },
      flags
    );
    return;
  }

  const { fileId } = await uploadAndImportWorkflow({
    compiled,
    messageCoRelationId,
    projectKey,
    flags,
    fileName: `${basename(workflowBindingKey(filePath)).replace(/\.(ya?ml|json)$/i, "") || "workflow"}.json`
  });

  if (!wait) {
    writeOutput({ submitted: true, fileId }, flags);
    return;
  }

  progress(`Waiting for import (correlation ${messageCoRelationId})...`);
  const notification = await pollImportNotification({
    messageCoRelationId,
    projectKey,
    flags,
    timeoutSeconds,
    pollIntervalSeconds,
    onWait: (seconds) => progress(`Still waiting... next check in ${seconds}s`)
  });

  const workflowId = notification.workflowId;
  if (!workflowId) {
    throw new CliActionableError(
      "Import finished but the notification did not include a workflowId.",
      "logic_import_failed"
    );
  }

  await recordWorkflowBinding(filePath, workflowId);

  const issues = notification.issues;
  if (issues > 0) {
    const warning = `Warning: blocks-logic reported ${issues} item${issues === 1 ? "" : "s"} skipped as invalid or disconnected.`;
    if (flags.json) console.error(warning);
    else console.log(warning);
  }

  writeOutput(
    {
      workflowId,
      name: notification.name ?? compiled.name,
      issues,
      nodeCount: notification.nodeCount ?? compiled.nodes.length
    },
    flags
  );
}

function collectTypes(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const nodes = (raw as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return [];
  const types: string[] = [];
  for (const node of nodes) {
    if (node && typeof node === "object" && !Array.isArray(node) && typeof (node as { type?: unknown }).type === "string") {
      types.push((node as { type: string }).type);
    }
  }
  return types;
}
