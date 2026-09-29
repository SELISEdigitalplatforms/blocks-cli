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
