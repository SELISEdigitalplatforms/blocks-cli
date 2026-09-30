import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { ensureParent, parseCommand, selectedProject, workspacePath } from "../../lib/workspace.js";
import {
  buildExportFromWorkflow,
  redactWorkflowSecrets,
  unwrapWorkflow,
  unwrapWorkflowList,
  workflowExportFileName,
  type WorkflowGraph
} from "../../lib/workflow-graph.js";

const readString = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
};

/**
 * Export one workflow (by id) or every workflow (`--all`) to portable JSON files that
 * `workflow import` can consume. Secrets embedded in node parameters (client secrets,
 * the x-blocks-key header) are stripped to `__REDACTED__` unless `--include-secrets`
 * is passed -- an export otherwise writes live credentials to disk.
 */
export async function workflowExport(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const includeSecrets = booleanFlag(flags, "include-secrets");
  const outDir = stringFlag(flags, "out-dir") || undefined;
  const explicitOut = stringFlag(flags, "out") || undefined;

  const ids: string[] = [];
  if (booleanFlag(flags, "all")) {
    let pageNumber = 0;
    const pageSize = integerFlag(flags, "page-size", 200);
    let totalCount = Infinity;
    const collected: Array<Record<string, unknown>> = [];
    while (collected.length < totalCount) {
      const page = unwrapWorkflowList(await blocksRequest<unknown>("/logic/v4/Workflow/GetAll", {
        body: { PageNumber: pageNumber, PageSize: pageSize },
        impersonatedProjectAuth: true,
        ...requestContext(flags),
        projectTenantId: projectKey
      }));
      totalCount = page.totalCount;
      if (page.items.length === 0) break;
      collected.push(...page.items);
      pageNumber += 1;
    }
    for (const item of collected) {
      const id = readString(item, "itemId", "ItemId", "id", "Id");
      if (id) ids.push(id);
    }
  } else {
    ids.push(args[0] || stringFlag(flags, "id", { required: true }));
  }

  const files: string[] = [];
  let totalRedacted = 0;

  for (const id of ids) {
    const workflow = unwrapWorkflow(await blocksRequest<unknown>("/logic/v4/Workflow/Get", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { WorkflowId: id }
    }));

    let graph: WorkflowGraph = buildExportFromWorkflow(workflow);
    if (!includeSecrets) {
      const redaction = redactWorkflowSecrets(graph);
      graph = redaction.graph;
      totalRedacted += redaction.redactedCount;
    }

    const path = explicitOut && ids.length === 1
      ? explicitOut
      : outDir
        ? join(outDir, workflowExportFileName(graph.name))
        : workspacePath("blocks", "workflows", workflowExportFileName(graph.name));

    await ensureParent(path);
    await writeFile(path, `${JSON.stringify(graph, null, 2)}\n`);
    files.push(path);
  }

  const warnings: string[] = [];
  if (includeSecrets) {
    warnings.push("Exported WITH secrets in cleartext (--include-secrets). Do not commit these files.");
  } else if (totalRedacted > 0) {
    warnings.push(`Redacted ${totalRedacted} secret value(s). Re-import with credentials or use --include-secrets for a runnable copy.`);
  }

  writeOutput({ files, count: files.length, ...(warnings.length ? { warnings } : {}) }, flags);
}
