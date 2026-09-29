import { readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { blocksRequest } from "./api.js";
import { CliActionableError } from "./errors.js";
import { findProjectByTenantId } from "./project-info.js";
import { requestContext } from "./request-context.js";
import { readWorkspaceConfig, writeWorkspaceConfig, type BlocksWorkspaceConfig } from "./workspace.js";
import type { WorkflowExportFile } from "./logic-compiler.js";

type Flags = Record<string, string | boolean>;

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export function workflowBindingKey(filePath: string, cwd = process.cwd()): string {
  const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(cwd, filePath);
  const rel = relative(cwd, abs);
  return rel.startsWith("..") ? abs : rel.replaceAll("\\", "/");
}

export async function getExistingWorkflowBinding(filePath: string): Promise<string | undefined> {
  const config = await readWorkspaceConfig();
  const key = workflowBindingKey(filePath);
  return config.logic?.workflows?.[key];
}

export async function recordWorkflowBinding(filePath: string, workflowId: string): Promise<void> {
  const config = await readWorkspaceConfig();
  const key = workflowBindingKey(filePath);
  const next: BlocksWorkspaceConfig = {
    ...config,
    logic: {
      ...config.logic,
      workflows: {
        ...(config.logic?.workflows ?? {}),
        [key]: workflowId
      }
    }
  };
  await writeWorkspaceConfig(next);
}

export async function resolveProjectShortKey(
  projectTenantId: string,
  flags: Flags
): Promise<string> {
  const fromFlag = typeof flags["project-slug"] === "string" ? flags["project-slug"].trim() : "";
  if (fromFlag) return fromFlag;
  const fromEnv = (process.env.BLOCKS_PROJECT_SHORT_KEY ?? "").trim();
  if (fromEnv) return fromEnv;
  try {
    const { project } = await findProjectByTenantId(projectTenantId, flags);
    const slug =
      readString(project, "tenantSlug", "TenantSlug", "shortKey", "ShortKey", "slug", "Slug", "name", "Name") ??
      projectTenantId;
    return slug;
  } catch {
    return projectTenantId;
  }
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export async function uploadAndImportWorkflow(options: {
  compiled: WorkflowExportFile;
  messageCoRelationId: string;
  projectKey: string;
  flags: Flags;
  fileName?: string;
}): Promise<{ fileId: string }> {
  const bodyText = `${JSON.stringify(options.compiled, null, 2)}\n`;
  const bytes = Buffer.byteLength(bodyText, "utf8");
  if (bytes > MAX_IMPORT_BYTES) {
    throw new CliActionableError(
      `Compiled workflow exceeds the ${MAX_IMPORT_BYTES / (1024 * 1024)} MB import limit.`,
      "logic_bad_shape"
    );
  }

  const name = options.fileName ?? `${options.compiled.name.replace(/[^\w.-]+/g, "_") || "workflow"}.json`;

  const ctx = {
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };

  const presign = await blocksRequest<Record<string, unknown>>("/logic/v4/Storage/GetPreSignedUrlForUpload", {
    ...ctx,
    body: {
      itemId: "",
      name,
      configurationName: "Default",
      metaData: "",
      parentDirectoryId: "",
      tags: "",
      accessModifier: "Private",
      moduleName: 3 // ModuleName.DefaultCloud
    }
  });

  const uploadUrl = firstString(presign, ["uploadUrl", "UploadUrl", "url", "preSignedUrl"]);
  const fileId = firstString(presign, ["fileId", "FileId", "itemId", "ItemId"]);
  if (!uploadUrl || !fileId) {
    throw new CliActionableError(
      `Presign response missing uploadUrl/fileId: ${JSON.stringify(presign)}`,
      "logic_import_failed"
    );
  }

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: bodyText
  });
  if (!put.ok) {
    throw new CliActionableError(
      `Upload to presigned URL failed with HTTP ${put.status}.`,
      "logic_import_failed"
    );
  }

  // Match the portal client: FileId comes from the presign response; Import is fire-and-forget.
  const imported = await blocksRequest<Record<string, unknown>>("/logic/v4/Workflow/Import", {
    ...ctx,
    body: {
      FileId: fileId,
      MessageCoRelationId: options.messageCoRelationId,
      fileId,
      messageCoRelationId: options.messageCoRelationId
    }
  });

  if (imported && imported.isSuccess === false) {
    throw new CliActionableError(
      `Workflow import enqueue failed: ${JSON.stringify(imported)}`,
      "logic_import_failed"
    );
  }

  return { fileId };
}

export type ImportNotification = {
  correlationId: string;
  isSuccess: boolean;
  workflowId?: string;
  issues: number;
  description?: string;
  name?: string;
  nodeCount?: number;
};

export async function pollImportNotification(options: {
  messageCoRelationId: string;
  projectKey: string;
  flags: Flags;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  onWait?: (seconds: number) => void;
}): Promise<ImportNotification> {
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  const ctx = {
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };

  while (true) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      throw new CliActionableError(
        `Import was submitted but did not finish within ${options.timeoutSeconds}s.`,
        "logic_import_timeout",
        "Check 'blocks notifier list' for the result, or re-run with a longer --timeout."
      );
    }

    const page = await blocksRequest<unknown>("/logic/v4/Notifier/GetNotifications", {
      ...ctx,
      query: {
        Page: 0,
        PageSize: 50,
        "Sort.IsDescending": true,
        "Sort.Property": "CreatedTime"
      }
    });

    const match = findMatchingNotification(page, options.messageCoRelationId);
    if (match) {
      if (!match.isSuccess) {
        throw new CliActionableError(
          match.description || "Workflow import failed.",
          "logic_import_failed"
        );
      }
      return match;
    }

    const sleepMs = Math.min(options.pollIntervalSeconds * 1000, Math.max(100, remaining));
    options.onWait?.(Math.ceil(sleepMs / 1000));
    await sleep(sleepMs);
  }
}

export function findMatchingNotification(page: unknown, correlationId: string): ImportNotification | undefined {
  for (const item of unwrapNotifications(page)) {
    const parsed = parseNotificationItem(item);
    if (parsed && parsed.correlationId === correlationId) return parsed;
  }
  return undefined;
}

function unwrapNotifications(page: unknown): unknown[] {
  if (Array.isArray(page)) return page;
  if (!isRecord(page)) return [];
  for (const key of ["data", "Data", "items", "Items", "notifications", "Notifications", "result", "Result"]) {
    const value = page[key];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function parseNotificationItem(item: unknown): ImportNotification | undefined {
  if (!isRecord(item)) return undefined;
  const correlationId =
    readString(item, "CorrelationId", "correlationId", "responseKey", "ResponseKey") ??
    undefined;
  if (!correlationId) return undefined;

  const payload = coercePayload(
    item.DenormalizedPayload ?? item.denormalizedPayload ?? item.Payload ?? item.payload ?? item
  );
  const message = isRecord(payload)
    ? (asRecord(payload.Message) ?? asRecord(payload.message) ?? payload)
    : null;

  const isSuccess =
    toBool(message?.IsSuccess) ??
    toBool(message?.isSuccess) ??
    toBool(item.ResponseValue) ??
    toBool(item.responseValue) ??
    true;

  const issuesRaw = message?.issues ?? message?.Issues;
  const issues = typeof issuesRaw === "number" && Number.isFinite(issuesRaw) ? issuesRaw : 0;
  const workflowId = message ? readString(message, "workflowId", "WorkflowId") : undefined;
  const description = message ? readString(message, "description", "Description") : undefined;
  const name = message ? readString(message, "name", "Name") : undefined;
  const nodeCountRaw = message?.nodeCount ?? message?.NodeCount;
  const nodeCount =
    typeof nodeCountRaw === "number" && Number.isFinite(nodeCountRaw) ? nodeCountRaw : undefined;

  return { correlationId, isSuccess, workflowId, issues, description, name, nodeCount };
}

function coercePayload(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toBool(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

export async function readWorkflowFile(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new CliActionableError(
        `Workflow file not found: ${filePath}`,
        "logic_bad_shape",
        "Pass a path to an existing YAML (or JSON) workflow file."
      );
    }
    throw error;
  }
}

export type LogicNodeDto = {
  id: string;
  name: string;
  category: string;
  type: string;
  version: string;
  position: { x: number; y: number };
  parameters: Record<string, unknown>;
  settings: Record<string, unknown>;
  pinData: null;
};

export type LogicEdgeDto = {
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
};

export type WorkflowUpdateBody = {
  ItemId: string;
  itemId: string;
  Name: string;
  name: string;
  Nodes: LogicNodeDto[];
  nodes: LogicNodeDto[];
  Edges: LogicEdgeDto[];
  edges: LogicEdgeDto[];
  Settings: Record<string, unknown>;
  settings: Record<string, unknown>;
};

/** Map a compiled export document into the dual-cased Update request body. */
export function compiledToUpdateBody(workflowId: string, compiled: WorkflowExportFile): WorkflowUpdateBody {
  const nodes: LogicNodeDto[] = compiled.nodes.map((node) => ({
    id: node.id,
    name: node.name,
    category: node.category,
    type: node.type,
    version: node.version,
    position: { x: node.position.x, y: node.position.y },
    parameters: node.parameters,
    settings: node.settings,
    pinData: null
  }));
  const edges: LogicEdgeDto[] = compiled.edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle
  }));
  return {
    ItemId: workflowId,
    itemId: workflowId,
    Name: compiled.name,
    name: compiled.name,
    Nodes: nodes,
    nodes,
    Edges: edges,
    edges,
    Settings: compiled.settings,
    settings: compiled.settings
  };
}

export async function updateWorkflow(options: {
  workflowId: string;
  compiled: WorkflowExportFile;
  projectKey: string;
  flags: Flags;
}): Promise<Record<string, unknown>> {
  const body = compiledToUpdateBody(options.workflowId, options.compiled);
  const ctx = {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
  const result = await blocksRequest<Record<string, unknown>>("/logic/v4/Workflow/Update", {
    ...ctx,
    method: "PUT",
    body
  });
  if (result && result.isSuccess === false) {
    throw new CliActionableError(
      `Workflow update failed: ${JSON.stringify(result)}`,
      "logic_import_failed"
    );
  }
  return result ?? {};
}

const FILE_LIKE = /\.(ya?ml|json)$/i;

/**
 * Resolve a publish target that may be a workflowId or a local file path whose
 * workflowId is recorded in blocks.json.
 */
export async function resolveWorkflowIdOrFile(target: string): Promise<{ workflowId: string; fromFile?: string }> {
  const looksLikeFile = FILE_LIKE.test(target) || target.includes("/") || target.includes("\\");
  if (looksLikeFile) {
    const bound = await getExistingWorkflowBinding(target);
    if (!bound) {
      throw new CliActionableError(
        `'${target}' has no recorded workflowId. Push it first.`,
        "logic_not_a_pushed_file"
      );
    }
    return { workflowId: bound, fromFile: target };
  }

  // Prefer an explicit binding when the user passes a relative path without extension
  // that happens to exist in blocks.json; otherwise treat as a raw id.
  const maybeBound = await getExistingWorkflowBinding(target);
  if (maybeBound) {
    return { workflowId: maybeBound, fromFile: target };
  }
  return { workflowId: target };
}

export async function getWorkflowRecord(options: {
  workflowId: string;
  projectKey: string;
  flags: Flags;
}): Promise<unknown> {
  const ctx = {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
  let result: unknown;
  try {
    result = await blocksRequest<unknown>("/logic/v4/Workflow/Get", {
      ...ctx,
      query: { WorkflowId: options.workflowId, workflowId: options.workflowId, ItemId: options.workflowId, itemId: options.workflowId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message) || /not found/i.test(message)) {
      throw new CliActionableError(
        `No workflow with id '${options.workflowId}'.`,
        "logic_workflow_not_found"
      );
    }
    throw error;
  }

  if (result == null || result === "") {
    throw new CliActionableError(
      `No workflow with id '${options.workflowId}'.`,
      "logic_workflow_not_found"
    );
  }
  if (isRecord(result) && result.isSuccess === false) {
    throw new CliActionableError(
      `No workflow with id '${options.workflowId}'.`,
      "logic_workflow_not_found"
    );
  }
  if (isRecord(result) && result.data === null) {
    throw new CliActionableError(
      `No workflow with id '${options.workflowId}'.`,
      "logic_workflow_not_found"
    );
  }
  return result;
}

export async function listWorkflows(options: {
  projectKey: string;
  flags: Flags;
  search?: string;
  publishedOnly?: boolean;
  pageNumber: number;
  pageSize: number;
}): Promise<unknown> {
  const ctx = {
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
  return blocksRequest<unknown>("/logic/v4/Workflow/GetAll", {
    ...ctx,
    body: {
      Search: options.search,
      search: options.search,
      IsPublished: options.publishedOnly === true ? true : undefined,
      isPublished: options.publishedOnly === true ? true : undefined,
      PageNumber: options.pageNumber,
      pageNumber: options.pageNumber,
      PageSize: options.pageSize,
      pageSize: options.pageSize
    }
  });
}

export async function publishWorkflow(options: {
  workflowId: string;
  projectKey: string;
  flags: Flags;
  versionName?: string;
}): Promise<{ workflowId: string; published: true; versionId?: string; raw: unknown }> {
  // Confirm the workflow exists before publishing so missing ids surface as
  // logic_workflow_not_found rather than a generic upstream envelope.
  await getWorkflowRecord({
    workflowId: options.workflowId,
    projectKey: options.projectKey,
    flags: options.flags
  });

  const ctx = {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };

  let result: Record<string, unknown>;
  try {
    if (options.versionName) {
      result = await blocksRequest<Record<string, unknown>>("/logic/v4/Workflow/PublishNewVersion", {
        ...ctx,
        body: {
          WorkflowId: options.workflowId,
          workflowId: options.workflowId,
          Name: options.versionName,
          name: options.versionName
        }
      });
    } else {
      result = await blocksRequest<Record<string, unknown>>("/logic/v4/Workflow/PublishVersion", {
        ...ctx,
        body: {
          WorkflowId: options.workflowId,
          workflowId: options.workflowId
        }
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(message, "logic_publish_failed");
  }

  if (result && result.isSuccess === false) {
    const upstream =
      readString(result, "description", "Description", "message", "Message", "detail", "Detail") ??
      JSON.stringify(result);
    throw new CliActionableError(upstream, "logic_publish_failed");
  }

  const versionId =
    readString(result ?? {}, "versionId", "VersionId") ??
    (isRecord(result?.data) ? readString(result.data as Record<string, unknown>, "versionId", "VersionId") : undefined);

  return {
    workflowId: options.workflowId,
    published: true,
    ...(versionId && options.versionName ? { versionId } : {}),
    raw: result
  };
}
