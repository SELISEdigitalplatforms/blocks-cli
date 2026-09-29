import { randomUUID } from "node:crypto";

/**
 * A workflow export/import graph. This is EXACTLY the shape the workflow editor's
 * "Export" produces and "Import" consumes -- `{ name, settings, nodes[], edges[] }`,
 * no wrapper. The CLI reads/writes this same file so the two are interchangeable.
 */
export interface WorkflowGraph {
  name: string;
  settings: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/**
 * Node types whose parameters carry a tenant-scoped project key. On import into a
 * different project these must be re-pointed at the destination tenant, mirroring
 * the server importer (WorkflowImportMapper.RewriteProjectIdentity in blocks-logic).
 */
const NODES_REQUIRING_PROJECT_KEY = new Set(["dataaction", "datagateway", "sendmail"]);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/**
 * Validate that a parsed JSON value is a workflow export, throwing an actionable
 * error otherwise. Mirrors the editor's pre-flight: name is a non-empty string,
 * nodes/edges are arrays, settings is an object.
 */
export function preflightWorkflowGraph(parsed: unknown): WorkflowGraph {
  if (!isPlainObject(parsed)) {
    throw new Error("Not a valid workflow export: the root is not a JSON object.");
  }
  const { name, nodes, edges, settings } = parsed;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Not a valid workflow export: missing a non-empty 'name'.");
  }
  if (!Array.isArray(nodes)) throw new Error("Not a valid workflow export: 'nodes' must be an array.");
  if (!Array.isArray(edges)) throw new Error("Not a valid workflow export: 'edges' must be an array.");
  if (!isPlainObject(settings)) throw new Error("Not a valid workflow export: 'settings' must be an object.");

  return {
    name,
    settings,
    nodes: nodes.filter(isPlainObject),
    edges: edges.filter(isPlainObject),
  };
}

const NON_TOKEN_HEX = /[0-9A-Za-z]/;

/**
 * Replace every whole-token occurrence of each `oldId` with its `newId` inside a
 * string. A "token" is a run of alphanumerics, so an id standing alone or embedded
 * as `node_<id>_<handle>` is rewritten, but a chance substring inside a longer run
 * is left alone. Ported verbatim from the editor's `replaceIdsInString` so the CLI
 * and the browser produce byte-identical imports.
 */
export function replaceIdsInString(value: string, idMap: ReadonlyMap<string, string>): string {
  let out = value;
  for (const [oldId, newId] of idMap) {
    if (!oldId || oldId === newId || !out.includes(oldId)) continue;
    let result = "";
    let from = 0;
    let idx = out.indexOf(oldId, from);
    while (idx !== -1) {
      const before = idx > 0 ? out[idx - 1] : "";
      const afterIdx = idx + oldId.length;
      const after = afterIdx < out.length ? out[afterIdx] : "";
      const isWholeToken = !NON_TOKEN_HEX.test(before) && !NON_TOKEN_HEX.test(after);
      result += out.slice(from, idx) + (isWholeToken ? newId : oldId);
      from = afterIdx;
      idx = out.indexOf(oldId, from);
    }
    result += out.slice(from);
    out = result;
  }
  return out;
}

const remapValueIds = <T>(value: T, idMap: ReadonlyMap<string, string>): T => {
  if (value === undefined) return value;
  const json = JSON.stringify(value);
  if (json === undefined) return value;
  return JSON.parse(replaceIdsInString(json, idMap)) as T;
};

const hasNumericPosition = (value: unknown): boolean =>
  isPlainObject(value) &&
  typeof value.x === "number" && Number.isFinite(value.x) &&
  typeof value.y === "number" && Number.isFinite(value.y);

const isValidNode = (node: unknown): node is Record<string, unknown> =>
  isPlainObject(node) &&
  isNonEmptyString(node.id) &&
  isNonEmptyString(node.name) &&
  isNonEmptyString(node.type) &&
  isNonEmptyString(node.category) &&
  isNonEmptyString(node.version) &&
  hasNumericPosition(node.position);

const freshNodeId = (): string => randomUUID().replace(/-/g, "");

export interface RemappedGraph {
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  settings: Record<string, unknown>;
  issues: number;
}

/**
 * Assign fresh node ids and rewrite everything that references them. Malformed
 * nodes, duplicate ids and dangling edges are dropped and counted (non-fatal),
 * matching the server importer so a round-tripped file behaves identically whether
 * it goes through the portal or the CLI.
 */
export function remapAndSanitise(graph: WorkflowGraph): RemappedGraph {
  let issues = 0;

  const valid: Array<Record<string, unknown>> = [];
  for (const node of graph.nodes) {
    if (isValidNode(node)) valid.push(node);
    else issues += 1;
  }

  const seen = new Set<string>();
  const survivors: Array<Record<string, unknown>> = [];
  for (const node of valid) {
    const id = node.id as string;
    if (seen.has(id)) { issues += 1; continue; }
    seen.add(id);
    survivors.push(node);
  }

  const idMap = new Map<string, string>();
  for (const node of survivors) idMap.set(node.id as string, freshNodeId());

  const nodes = survivors.map((node) => {
    const newId = idMap.get(node.id as string) as string;
    const next: Record<string, unknown> = { ...node, id: newId };
    if ("parameters" in node) next.parameters = remapValueIds(node.parameters, idMap);
    if ("settings" in node) next.settings = remapValueIds(node.settings, idMap);
    if ("pinData" in node) next.pinData = remapValueIds(node.pinData, idMap);
    return next;
  });

  const settings: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(graph.settings)) {
    settings[key] = typeof value === "string" ? replaceIdsInString(value, idMap) : value;
  }

  const edges: Array<Record<string, unknown>> = [];
  const usedEdgeIds = new Set<string>();
  graph.edges.forEach((edge, index) => {
    const newSource = typeof edge.source === "string" ? idMap.get(edge.source) : undefined;
    const newTarget = typeof edge.target === "string" ? idMap.get(edge.target) : undefined;
    if (!newSource || !newTarget) { issues += 1; return; }
    let id = `xy-edge__${newSource}-${newTarget}`;
    if (usedEdgeIds.has(id)) id = `${id}-${index}`;
    usedEdgeIds.add(id);
    edges.push({ ...edge, id, source: newSource, target: newTarget });
  });

  return { nodes, edges, settings, issues };
}

export interface ProjectRewriteResult {
  /** Nodes that carry a `projectShortKey` but no slug was supplied to update it. */
  unresolvedShortKeyNodes: string[];
}

/**
 * Re-point tenant-scoped keys at the destination project. Mirrors
 * WorkflowImportMapper.RewriteProjectIdentity: dataAction/dataGateway/sendMail nodes
 * (or any node already carrying a projectKey) get `projectKey` set to the tenant id;
 * `projectShortKey` is updated only when a slug is supplied; sendMail's `EmailTemplate`
 * is namespaced as `<Template>_<tenantId>`. Mutates `nodes` in place.
 */
export function rewriteProjectIdentity(
  nodes: Array<Record<string, unknown>>,
  tenantId: string,
  tenantSlug?: string,
): ProjectRewriteResult {
  const unresolvedShortKeyNodes: string[] = [];

  for (const node of nodes) {
    const params = isPlainObject(node.parameters) ? node.parameters : (node.parameters = {});
    const type = (typeof node.type === "string" ? node.type : "").toLowerCase();
    const hasCamel = "projectKey" in params;
    const hasPascal = "ProjectKey" in params;

    if (hasCamel || hasPascal || NODES_REQUIRING_PROJECT_KEY.has(type)) {
      params.projectKey = tenantId;
    }
    if (hasPascal) params.ProjectKey = tenantId;

    const hasShortKey = "projectShortKey" in params || "ProjectShortKey" in params;
    if (hasShortKey) {
      if (tenantSlug) {
        if ("projectShortKey" in params) params.projectShortKey = tenantSlug;
        if ("ProjectShortKey" in params) params.ProjectShortKey = tenantSlug;
      } else {
        unresolvedShortKeyNodes.push(String(node.name ?? node.id ?? type));
      }
    }

    if (type === "sendmail" && typeof params.Template === "string" && params.Template) {
      params.EmailTemplate = `${params.Template}_${tenantId}`;
    }
  }

  return { unresolvedShortKeyNodes };
}

export const REDACTED = "__REDACTED__";

/** Parameter fields that hold a live secret and are stripped on export by default. */
const SECRET_PARAM_KEYS = ["clientSecret", "clientCredential_composite"];
const SECRET_HEADER_KEYS = ["x-blocks-key"];

export interface RedactionResult {
  graph: WorkflowGraph;
  redactedCount: number;
}

/**
 * Return a copy of the graph with node-parameter secrets replaced by a placeholder:
 * `clientSecret`, `clientCredential_composite`, and the `x-blocks-key` header value.
 * Exports embed these verbatim, so this is on by default; `--include-secrets` skips it.
 */
export function redactWorkflowSecrets(graph: WorkflowGraph): RedactionResult {
  let redactedCount = 0;
  const clone: WorkflowGraph = JSON.parse(JSON.stringify(graph));

  for (const node of clone.nodes) {
    if (!isPlainObject(node.parameters)) continue;
    const params = node.parameters;
    for (const key of SECRET_PARAM_KEYS) {
      if (isNonEmptyString(params[key])) { params[key] = REDACTED; redactedCount += 1; }
    }
    if (isPlainObject(params.headers)) {
      for (const key of SECRET_HEADER_KEYS) {
        if (isNonEmptyString(params.headers[key])) { params.headers[key] = REDACTED; redactedCount += 1; }
      }
    }
  }

  return { graph: clone, redactedCount };
}

const toNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : Number(value) || 0;

const pickNode = (node: Record<string, unknown>): Record<string, unknown> => {
  const pos = isPlainObject(node.position) ? node.position : {};
  const exported: Record<string, unknown> = {
    id: String(node.id ?? ""),
    name: String(node.name ?? ""),
    category: String(node.category ?? ""),
    type: String(node.type ?? ""),
    version: String(node.version ?? ""),
    position: { x: toNumber(pos.x ?? (pos as Record<string, unknown>).X), y: toNumber(pos.y ?? (pos as Record<string, unknown>).Y) },
    parameters: isPlainObject(node.parameters) ? node.parameters : {},
    settings: isPlainObject(node.settings) ? node.settings : {},
    pinData: Array.isArray(node.pinData) ? node.pinData : null,
  };
  if (node.handle !== undefined) exported.handle = node.handle;
  return exported;
};

const pickEdge = (edge: Record<string, unknown>): Record<string, unknown> => ({
  ...edge,
  id: String(edge.id ?? ""),
  source: String(edge.source ?? ""),
  target: String(edge.target ?? ""),
  sourceHandle: String(edge.sourceHandle ?? (edge as Record<string, unknown>).SourceHandle ?? ""),
  targetHandle: String(edge.targetHandle ?? (edge as Record<string, unknown>).TargetHandle ?? ""),
});

/**
 * Reshape a `Workflow/Get` response into an export file. Only name/settings/nodes/edges
 * survive; itemId/tenantId/publish/audit fields are dropped. Mirrors the editor's
 * `buildWorkflowExport`.
 */
export function buildExportFromWorkflow(workflow: Record<string, unknown>): WorkflowGraph {
  const nodes = Array.isArray(workflow.nodes) ? (workflow.nodes as unknown[]).filter(isPlainObject) : [];
  const edges = Array.isArray(workflow.edges) ? (workflow.edges as unknown[]).filter(isPlainObject) : [];
  return {
    name: typeof workflow.name === "string" ? workflow.name : "",
    settings: isPlainObject(workflow.settings) ? workflow.settings : {},
    nodes: nodes.map(pickNode),
    edges: edges.map(pickEdge),
  };
}

/** Unwrap the `{ data: {...} }` envelope a `Workflow/Get` response carries. */
export function unwrapWorkflow(response: unknown): Record<string, unknown> {
  if (isPlainObject(response) && isPlainObject(response.data)) return response.data;
  if (isPlainObject(response)) return response;
  throw new Error("Unexpected Workflow/Get response shape.");
}

/** Extract the list array + total count from a `Workflow/GetAll` response, tolerant of envelope casing. */
export function unwrapWorkflowList(response: unknown): { items: Array<Record<string, unknown>>; totalCount: number } {
  if (!isPlainObject(response)) return { items: [], totalCount: 0 };
  const arrayField = [response.data, response.items, response.Data, response.Items].find(Array.isArray) as unknown[] | undefined;
  const items = (arrayField ?? []).filter(isPlainObject);
  const totalRaw = response.totalCount ?? response.TotalCount ?? items.length;
  const totalCount = typeof totalRaw === "number" && Number.isFinite(totalRaw) ? totalRaw : items.length;
  return { items, totalCount };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

export const slugifyWorkflowName = (name: string): string =>
  (name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** `<slug(name)|"workflow">-<YYYY-MM-DD>.json` */
export function workflowExportFileName(name: string, date: Date = new Date()): string {
  const slug = slugifyWorkflowName(name) || "workflow";
  const stamp = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  return `${slug}-${stamp}.json`;
}
