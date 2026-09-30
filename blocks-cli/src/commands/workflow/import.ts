import { readFile } from "node:fs/promises";
import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";
import {
  MAX_IMPORT_BYTES,
  preflightWorkflowGraph,
  remapAndSanitise,
  rewriteProjectIdentity,
  unwrapWorkflowList
} from "../../lib/workflow-graph.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
};

/**
 * Turn an exported workflow file into a live workflow in the selected project. This
 * is the agent-facing path: it validates the graph, assigns fresh node ids and rewrites
 * edges, re-points tenant-scoped keys (dataAction/dataGateway/sendMail) at the
 * destination project, then upserts by name (Update when a workflow of the same name
 * exists, Create otherwise). With `--publish` it also activates the workflow.
 *
 * A workflow is never looked up by the file's own id -- that id may belong to another
 * project -- only by name, mirroring `data schema push`.
 */
export async function workflowImport(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const file = stringFlag(flags, "file", { required: true });

  const text = await readFile(file, "utf8");
  if (Buffer.byteLength(text, "utf8") > MAX_IMPORT_BYTES) {
    throw new Error(`${file} is larger than the ${MAX_IMPORT_BYTES / (1024 * 1024)} MB import limit.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Could not parse ${file}: ${(error as Error).message}`);
  }

  const graph = preflightWorkflowGraph(parsed);
  const name = stringFlag(flags, "name") || graph.name;
  const projectKey = await selectedProject(flags);
  const projectSlug = stringFlag(flags, "project-slug") || undefined;

  const { nodes, edges, settings, issues } = remapAndSanitise(graph);
  const { unresolvedShortKeyNodes } = rewriteProjectIdentity(nodes, projectKey, projectSlug);

  const warnings: string[] = [];
  if (issues > 0) {
    warnings.push(`${issues} node(s)/edge(s) were dropped because they were invalid or disconnected.`);
  }
  if (unresolvedShortKeyNodes.length) {
    warnings.push(
      `Could not update projectShortKey on: ${unresolvedShortKeyNodes.join(", ")}. `
      + "Pass --project-slug <slug> so these nodes point at this project."
    );
  }
  const redactedPlaceholders = nodes.some((node) =>
    isRecord(node.parameters) && JSON.stringify(node.parameters).includes("__REDACTED__"));
  if (redactedPlaceholders) {
    warnings.push("This file contains __REDACTED__ secret placeholders. Fill them in before the workflow will run.");
  }

  // Look up the destination project's own workflow of this name; never trust the file's id.
  const existing = unwrapWorkflowList(await blocksRequest<unknown>("/logic/v4/Workflow/GetAll", {
    body: { Search: name, PageSize: 100, PageNumber: 0 },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  }));
  const match = existing.items.find((item) => readString(item, "name", "Name")?.toLowerCase() === name.toLowerCase());
  const destinationId = match ? readString(match, "itemId", "ItemId", "id", "Id") : undefined;

  const action = destinationId ? "update" : "create";
  const willPublish = booleanFlag(flags, "publish");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({
      dryRun: true, action, name, nodeCount: nodes.length, edgeCount: edges.length,
      willPublish, ...(warnings.length ? { warnings } : {})
    }, flags);
    return;
  }

  await confirmMutation(flags, `${action === "update" ? "Update" : "Create"} workflow '${name}' in project '${projectKey}'${willPublish ? " and publish it" : ""}.`);

  const saveOptions = {
    acceptFailureEnvelope: true,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  } as const;

  const saveResponse = destinationId
    ? await blocksRequest<unknown>("/logic/v4/Workflow/Update", {
      ...saveOptions,
      body: { itemId: destinationId, name, nodes, edges, settings },
      method: "PUT"
    })
    : await blocksRequest<unknown>("/logic/v4/Workflow/Create", {
      ...saveOptions,
      body: { name, nodes, edges, settings },
      method: "POST"
    });

  if (!isRecord(saveResponse) || saveResponse.isSuccess === false) {
    throw new Error(`Import failed for workflow '${name}': ${JSON.stringify(saveResponse)}`);
  }

  const workflowId = destinationId ?? readString(saveResponse, "itemId", "ItemId") ?? undefined;

  let published: unknown;
  if (willPublish) {
    if (!workflowId) throw new Error(`Workflow '${name}' was saved but its id could not be resolved to publish it.`);
    published = await blocksRequest<unknown>("/logic/v4/Workflow/PublishNewVersion", {
      body: { workflowId, name },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    });
  }

  writeOutput({
    action, name, workflowId, issues,
    ...(willPublish ? { published: true, publishResult: published } : {}),
    ...(warnings.length ? { warnings } : {})
  }, flags);
}
