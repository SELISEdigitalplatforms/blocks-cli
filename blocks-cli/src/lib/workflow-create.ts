import { blocksRequest } from "./api.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (record: Record<string, unknown>, ...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
};

export const WORKFLOW_CREATE_ENDPOINT = "/logic/v4/Workflow/Create";
export const WORKFLOW_UPDATE_ENDPOINT = "/logic/v4/Workflow/Update";
export const WORKFLOW_DELETE_ENDPOINT = "/logic/v4/Workflow/Delete";

export interface WorkflowCreateRequestContext {
  apiUrl?: string;
  accountName?: string;
  projectTenantId: string;
}

export interface WorkflowCreateStep {
  endpoint: string;
  method: "POST" | "PUT";
  request: Record<string, unknown>;
}

/**
 * Split a workflow body into the two requests the create path sends.
 *
 * `POST /logic/v4/Workflow/Create` deserializes `nodes` with Newtonsoft straight into
 * `NodeEntity`, whose `Parameters`/`Settings` are `BsonDocument` -- Newtonsoft treats
 * that type as a collection, so any node with an object `parameters` 500s ("Cannot
 * deserialize the current JSON object ... into type 'MongoDB.Bson.BsonDocument'").
 * `PUT /logic/v4/Workflow/Update` binds nodes as `JsonElement` and uses
 * `BsonDocument.Parse`, which is correct. So Create carries the fields only it reads
 * (name, description, settings -- Update ignores settings and description) with an
 * empty graph, and Update fills in the nodes and edges.
 */
export function planWorkflowCreate(body: Record<string, unknown>): {
  create: WorkflowCreateStep;
  update?: Omit<WorkflowCreateStep, "request"> & { request: Omit<Record<string, unknown>, "itemId"> };
} {
  const { nodes, edges, ...rest } = body;
  const nodeList = Array.isArray(nodes) ? nodes : [];
  const edgeList = Array.isArray(edges) ? edges : [];
  const create: WorkflowCreateStep = {
    endpoint: WORKFLOW_CREATE_ENDPOINT,
    method: "POST",
    request: { ...rest, nodes: [], edges: [] }
  };
  if (!nodeList.length && !edgeList.length) return { create };
  return {
    create,
    update: {
      endpoint: WORKFLOW_UPDATE_ENDPOINT,
      method: "PUT",
      request: { ...(typeof rest.name === "string" ? { name: rest.name } : {}), nodes: nodeList, edges: edgeList }
    }
  };
}

/**
 * Create a workflow with a full graph, working around the Create endpoint's node
 * deserialization bug (see `planWorkflowCreate`). If filling in the graph fails, the
 * empty workflow just created is deleted so a failed create leaves nothing behind.
 * Returns the new workflow id and the final service response.
 */
export async function createWorkflow(
  body: Record<string, unknown>,
  context: WorkflowCreateRequestContext
): Promise<{ workflowId: string; response: Record<string, unknown> }> {
  const plan = planWorkflowCreate(body);
  const requestOptions = { acceptFailureEnvelope: true, impersonatedProjectAuth: true, ...context } as const;

  const created = await blocksRequest<unknown>(plan.create.endpoint, {
    ...requestOptions,
    body: plan.create.request,
    method: plan.create.method
  });
  if (!isRecord(created) || created.isSuccess === false) {
    throw new Error(`Workflow create failed: ${JSON.stringify(created)}`);
  }
  const workflowId = readString(created, "itemId", "ItemId");
  if (!workflowId) {
    throw new Error(`Workflow create did not return an id: ${JSON.stringify(created)}`);
  }
  if (!plan.update) return { workflowId, response: created };

  let updated: unknown;
  let failure: string;
  try {
    updated = await blocksRequest<unknown>(plan.update.endpoint, {
      ...requestOptions,
      body: { itemId: workflowId, ...plan.update.request },
      method: plan.update.method
    });
    if (isRecord(updated) && updated.isSuccess !== false) return { workflowId, response: updated };
    failure = JSON.stringify(updated);
  } catch (error) {
    failure = (error as Error).message;
  }

  let cleanup = `the empty workflow '${workflowId}' was deleted`;
  try {
    await blocksRequest<unknown>(WORKFLOW_DELETE_ENDPOINT, {
      ...requestOptions,
      method: "DELETE",
      query: { Id: workflowId }
    });
  } catch (error) {
    cleanup = `deleting the empty workflow '${workflowId}' also failed (${(error as Error).message}); remove it with 'blocks logic workflow delete ${workflowId} --yes'`;
  }
  throw new Error(`Workflow was created but saving its nodes and edges failed: ${failure}. ${cleanup}.`);
}
