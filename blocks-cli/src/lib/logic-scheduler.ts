import { readFile } from "node:fs/promises";
import { booleanFlag, integerFlag, stringFlag } from "./args.js";
import { blocksRequest } from "./api.js";
import { isRecord } from "./data-response.js";
import { CliActionableError } from "./errors.js";
import { requestContext } from "./request-context.js";

export const LOGIC_SCHEDULER_API = "/logic/v4/Scheduler";

type Flags = Record<string, string | boolean>;

export type SchedulerContext = { projectKey: string; flags: Flags };

function apiCtx(options: SchedulerContext) {
  return {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
}

function readString(record: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/** Collect every `--header key=value` from argv (parseFlags keeps only the last). */
export function collectHeaderFlags(argv: string[]): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--header") {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        values.push(next);
        i += 1;
      }
      continue;
    }
    if (token.startsWith("--header=")) values.push(token.slice("--header=".length));
  }
  return values;
}

export function parseHeaderPairs(raw: string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const entry of raw) {
    const eq = entry.indexOf("=");
    if (eq <= 0) {
      throw new CliActionableError(
        `--header must be key=value (got '${entry}').`,
        "scheduler_invalid_header"
      );
    }
    headers[entry.slice(0, eq)] = entry.slice(eq + 1);
  }
  return headers;
}

/** Plausible 5-field cron: five whitespace-separated tokens. */
export function assertCronExpression(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    throw new CliActionableError("Provide --cron with a 5-field cron expression.", "scheduler_invalid_cron");
  }
  const parts = raw.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new CliActionableError(
      `'${raw}' is not a plausible 5-field cron expression.`,
      "scheduler_invalid_cron"
    );
  }
  return parts.join(" ");
}

export function assertAbsoluteUrl(raw: string | undefined): string {
  if (!raw || !raw.trim()) {
    throw new CliActionableError("Provide --url with an absolute URL.", "scheduler_invalid_webhook_url");
  }
  const value = raw.trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
  } catch {
    throw new CliActionableError(
      `'${value}' is not an absolute URL.`,
      "scheduler_invalid_webhook_url"
    );
  }
  return value;
}

export async function readSchedulerFile(filePath: string): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await readFile(filePath, "utf8");
  } catch (error) {
    throw new CliActionableError(
      `Cannot read --file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
      "scheduler_file_unreadable"
    );
  }
  const stripped = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (error) {
    throw new CliActionableError(
      `--file ${filePath} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      "scheduler_file_invalid"
    );
  }
  if (!isRecord(parsed)) {
    throw new CliActionableError(`--file ${filePath} must contain a JSON object.`, "scheduler_file_invalid");
  }
  return parsed;
}

/** Strip signing secrets from any output object (deep). */
export function redactSchedulerSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSchedulerSecrets(item)) as T;
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (/signingsecret/i.test(key) || key === "signingSecret" || key === "SigningSecret") continue;
    out[key] = redactSchedulerSecrets(child);
  }
  return out as T;
}

export function buildCreateBodyFromFlags(flags: Flags, argv: string[]): Record<string, unknown> {
  const name = stringFlag(flags, "name");
  if (!name || !name.trim()) {
    throw new CliActionableError("Provide --name for the schedule.", "scheduler_name_required");
  }
  const cronExpression = assertCronExpression(stringFlag(flags, "cron") || undefined);
  const url = assertAbsoluteUrl(stringFlag(flags, "url") || undefined);
  const method = (stringFlag(flags, "method") || "POST").toUpperCase();
  // Touch --header for catalog detection.
  stringFlag(flags, "header");
  const headers = parseHeaderPairs(collectHeaderFlags(argv));
  const webhook: Record<string, unknown> = { url, method, headers };
  const signingSecret = stringFlag(flags, "signing-secret") || undefined;
  if (signingSecret) webhook.signingSecret = signingSecret;

  const body: Record<string, unknown> = {
    name: name.trim(),
    cronExpression,
    webhook,
    payload: stringFlag(flags, "payload") || "",
    isActive: true
  };
  const description = stringFlag(flags, "description");
  if (description) body.description = description;
  const startDate = stringFlag(flags, "start-date");
  if (startDate) body.startDate = startDate;
  const endDate = stringFlag(flags, "end-date");
  if (endDate) body.endDate = endDate;
  return body;
}

export function buildUpdateOverrides(flags: Flags, argv: string[]): Record<string, unknown> {
  const overrides: Record<string, unknown> = {};
  const name = stringFlag(flags, "name");
  if (name) overrides.name = name.trim();
  const description = stringFlag(flags, "description");
  if (description) overrides.description = description;
  const cron = stringFlag(flags, "cron");
  if (cron) overrides.cronExpression = assertCronExpression(cron);
  const payload = stringFlag(flags, "payload");
  if (payload !== "") {
    // empty string is a valid explicit clear; only skip when flag absent
    if (flags.payload !== undefined) overrides.payload = typeof flags.payload === "string" ? flags.payload : "";
  }
  const startDate = stringFlag(flags, "start-date");
  if (startDate) overrides.startDate = startDate;
  const endDate = stringFlag(flags, "end-date");
  if (endDate) overrides.endDate = endDate;

  stringFlag(flags, "header");
  const headerPairs = collectHeaderFlags(argv);
  const url = stringFlag(flags, "url");
  const method = stringFlag(flags, "method");
  const signingSecret = stringFlag(flags, "signing-secret");
  if (url || method || headerPairs.length || signingSecret) {
    const webhook: Record<string, unknown> = {};
    if (url) webhook.url = assertAbsoluteUrl(url);
    if (method) webhook.method = method.toUpperCase();
    if (headerPairs.length) webhook.headers = parseHeaderPairs(headerPairs);
    if (signingSecret) webhook.signingSecret = signingSecret;
    overrides.webhook = webhook;
  }

  if (booleanFlag(flags, "active")) overrides.isActive = true;
  if (booleanFlag(flags, "inactive")) overrides.isActive = false;

  return overrides;
}

function throwSchedulerError(data: unknown, fallback: string): never {
  const record = isRecord(data) ? data : {};
  const message =
    readString(record, "message", "Message", "description", "Description", "detail") ?? fallback;
  throw new CliActionableError(message, "scheduler_save_failed");
}

export async function createSchedule(options: SchedulerContext & { body: Record<string, unknown> }): Promise<{
  itemId: string;
  name: string;
  cronExpression: string;
  isActive: boolean;
}> {
  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(`${LOGIC_SCHEDULER_API}/CreateSchedule`, {
      ...apiCtx(options),
      body: options.body
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(message, "scheduler_save_failed");
  }
  if (result && result.isSuccess === false) throwSchedulerError(result, "CreateSchedule failed.");

  const itemId =
    readString(result ?? {}, "itemId", "ItemId") ??
    (isRecord(result?.data) ? readString(result.data as Record<string, unknown>, "itemId", "ItemId") : undefined);
  if (!itemId) {
    throw new CliActionableError(`CreateSchedule did not return an itemId: ${JSON.stringify(result)}`, "scheduler_save_failed");
  }

  return {
    itemId,
    name: String(options.body.name ?? ""),
    cronExpression: String(options.body.cronExpression ?? ""),
    isActive: true
  };
}

export async function listSchedules(options: SchedulerContext & {
  search?: string;
  page: number;
  pageSize: number;
}): Promise<unknown> {
  const result = await blocksRequest<unknown>(`${LOGIC_SCHEDULER_API}/GetSchedules`, {
    ...apiCtx(options),
    body: {
      Search: options.search,
      search: options.search,
      PageNumber: options.page,
      pageNumber: options.page,
      Page: options.page,
      page: options.page,
      PageSize: options.pageSize,
      pageSize: options.pageSize
    }
  });
  return redactSchedulerSecrets(result);
}

function schedulesFromList(response: unknown): Record<string, unknown>[] {
  if (Array.isArray(response)) return response.filter(isRecord);
  if (!isRecord(response)) return [];
  if (Array.isArray(response.data)) return response.data.filter(isRecord);
  if (isRecord(response.data) && Array.isArray(response.data.items)) {
    return response.data.items.filter(isRecord);
  }
  for (const value of Object.values(response)) {
    if (Array.isArray(value)) return value.filter(isRecord);
  }
  return [];
}

export async function findScheduleById(options: SchedulerContext & { scheduleId: string }): Promise<Record<string, unknown> | null> {
  // No GetById — page through GetSchedules looking for the id.
  for (let page = 0; page < 50; page += 1) {
    const listed = await blocksRequest<unknown>(`${LOGIC_SCHEDULER_API}/GetSchedules`, {
      ...apiCtx(options),
      body: { PageNumber: page, pageNumber: page, Page: page, page, PageSize: 100, pageSize: 100 }
    });
    const rows = schedulesFromList(listed);
    const hit = rows.find((row) => readString(row, "itemId", "ItemId") === options.scheduleId);
    if (hit) return hit;
    const total =
      (isRecord(listed) && typeof listed.totalCount === "number" && listed.totalCount) ||
      (isRecord(listed) && isRecord(listed.data) && typeof listed.data.totalCount === "number" && listed.data.totalCount) ||
      rows.length;
    if ((page + 1) * 100 >= total || rows.length === 0) break;
  }
  return null;
}

export function mergeScheduleUpdate(
  current: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const webhookCurrent = isRecord(current.webhook)
    ? { ...current.webhook }
    : isRecord(current.Webhook)
      ? { ...current.Webhook }
      : {};
  const webhookOverride = isRecord(overrides.webhook) ? overrides.webhook : {};
  const webhook = { ...webhookCurrent, ...webhookOverride };

  const body: Record<string, unknown> = {
    itemId: readString(current, "itemId", "ItemId"),
    ItemId: readString(current, "itemId", "ItemId"),
    name: current.name ?? current.Name,
    description: current.description ?? current.Description,
    payload: current.payload ?? current.Payload ?? "",
    cronExpression: current.cronExpression ?? current.CronExpression,
    startDate: current.startDate ?? current.StartDate,
    endDate: current.endDate ?? current.EndDate,
    isActive: current.isActive ?? current.IsActive ?? true,
    webhook
  };
  Object.assign(body, overrides);
  if (isRecord(overrides.webhook)) {
    body.webhook = webhook;
  }
  return body;
}

export async function updateSchedule(options: SchedulerContext & {
  scheduleId: string;
  overrides: Record<string, unknown>;
  replaceBody?: Record<string, unknown>;
}): Promise<{ itemId: string; name: string; cronExpression: string; isActive: boolean }> {
  const current = await findScheduleById({ ...options, scheduleId: options.scheduleId });
  if (!current) {
    throw new CliActionableError(
      `No schedule with id '${options.scheduleId}'.`,
      "scheduler_not_found"
    );
  }

  const body = options.replaceBody
    ? { ...options.replaceBody, itemId: options.scheduleId, ItemId: options.scheduleId }
    : mergeScheduleUpdate(current, options.overrides);

  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(`${LOGIC_SCHEDULER_API}/UpdateSchedule`, {
      ...apiCtx(options),
      body
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CliActionableError(message, "scheduler_save_failed");
  }
  if (result && result.isSuccess === false) throwSchedulerError(result, "UpdateSchedule failed.");

  return {
    itemId: options.scheduleId,
    name: String(body.name ?? ""),
    cronExpression: String(body.cronExpression ?? ""),
    isActive: Boolean(body.isActive !== undefined ? body.isActive : true)
  };
}

export async function deleteSchedule(options: SchedulerContext & { scheduleId: string }): Promise<{ itemId: string; deleted: true }> {
  // Confirm existence first so missing ids become scheduler_not_found.
  const current = await findScheduleById({ ...options, scheduleId: options.scheduleId });
  if (!current) {
    throw new CliActionableError(
      `No schedule with id '${options.scheduleId}'.`,
      "scheduler_not_found"
    );
  }

  let result: Record<string, unknown>;
  try {
    result = await blocksRequest<Record<string, unknown>>(`${LOGIC_SCHEDULER_API}/DeleteSchedule`, {
      ...apiCtx(options),
      body: { ItemId: options.scheduleId, itemId: options.scheduleId }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/\b404\b/.test(message) || /not found/i.test(message)) {
      throw new CliActionableError(
        `No schedule with id '${options.scheduleId}'.`,
        "scheduler_not_found"
      );
    }
    throw new CliActionableError(message, "scheduler_save_failed");
  }
  if (result && result.isSuccess === false) {
    throw new CliActionableError(
      readString(result, "message", "Message") ?? "DeleteSchedule failed.",
      "scheduler_not_found"
    );
  }
  return { itemId: options.scheduleId, deleted: true };
}

export function parseSchedulerPaging(flags: Flags): { page: number; pageSize: number } {
  const page = integerFlag(flags, "page", 0);
  if (page < 0) throw new Error("--page must be greater than or equal to 0");
  const pageSize = integerFlag(flags, "page-size", 10);
  if (pageSize < 1) throw new Error("--page-size must be greater than or equal to 1");
  return { page, pageSize };
}
