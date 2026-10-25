import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { booleanFlag, integerFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "./args.js";
import { blocksRequest } from "./api.js";
import { readConfig, resolveAccountProfile } from "./config.js";
import { isRecord } from "./data-response.js";
import { CliActionableError } from "./errors.js";
import { listFlag } from "./json-flag.js";
import { requestContext } from "./request-context.js";

/**
 * blocks-logic Functions. The management surface is `FunctionsController`'s
 * `[controller]/[action]` routes (`/logic/v4/Functions/<Action>`), each behind
 * `blocks-logic::function::read|manage`. The public invocation route
 * (`/logic/v4/fn/{id}/{**path}`) is app/SDK territory and is never called from here --
 * only its URL is composed, for `logic function url`.
 */
export const LOGIC_FUNCTIONS_API = "/logic/v4/Functions";

/** Path of the public invoke route under the API gateway (`FunctionsController.Invoke`). */
export const LOGIC_FUNCTION_INVOKE_PREFIX = "/logic/v4/fn";

/** Starter sources `Functions/Create` accepts (`FunctionStarterTemplates.Names`). */
export const FUNCTION_TEMPLATES = ["Minimal", "HttpEcho", "FetchTransform", "ReusedConnection"] as const;

/** `FunctionStatus` -- the list filter. */
export const FUNCTION_STATUSES = ["Draft", "Live", "Paused"] as const;

/** `RunStatus` names `GetRuns` parses (case-insensitively); `Running` also means "any active". */
export const RUN_STATUSES = [
  "Queued", "Claimed", "Starting", "Running", "OutputProcessing", "Succeeded",
  "Failed", "TimedOut", "Cancelled", "ResourceExceeded", "OutputFailed"
] as const;

/** `InvokedByType` -- the runs list's trigger filter. */
export const RUN_INVOKED_BY = ["Http", "Workflow", "Test", "Replay", "Schedule", "Event"] as const;

/** Verbs a trigger may list in `httpMethods` (`FunctionValidationRules.AllowedHttpMethods`). */
export const FUNCTION_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

/** `BuildStatus` values a pending deploy moves through. */
const BUILD_TERMINAL_OK = "Succeeded";
const BUILD_TERMINAL_FAILED = "Failed";

/** Files a function directory holds (`logic function export` / `save --dir`). */
export const FUNCTION_DIR_FILES = {
  index: "index.js",
  package: "package.json",
  lock: "package-lock.json",
  config: "function.json"
} as const;

type Flags = Record<string, string | boolean>;

export type FunctionRequestContext = { projectKey: string; flags: Flags };

function apiCtx(options: FunctionRequestContext) {
  return {
    acceptFailureEnvelope: true as const,
    impersonatedProjectAuth: true as const,
    ...requestContext(options.flags),
    projectTenantId: options.projectKey
  };
}

/**
 * `blocksRequest` reports a non-2xx as `Blocks API <status> <text>: <detail>`, where the
 * detail is the body's message or, for `FunctionExceptionFilter`'s `{ isSuccess:false,
 * errors:{…} }`, the body itself as JSON. This turns both back into a coded CLI error:
 * the status says what kind of refusal it was, and the filter's extra error keys
 * (`buildId`, `deleteBlocked`) say what to do next.
 */
export function mapFunctionError(error: unknown, subject: string): never {
  if (error instanceof CliActionableError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  const status = Number(message.match(/^Blocks API (\d{3})/)?.[1] ?? 0);

  let errors: Record<string, unknown> | undefined;
  const json = message.match(/:\s*(\{[\s\S]*\})\s*$/);
  if (json) {
    try {
      const parsed: unknown = JSON.parse(json[1]);
      if (isRecord(parsed) && isRecord(parsed.errors)) errors = parsed.errors;
    } catch {
      // Truncated or not JSON: the status alone still classifies it.
    }
  }

  if (errors?.deleteBlocked === "true") {
    throw new CliActionableError(
      `${subject} is still in use: ${String(errors.activeRuns ?? 0)} active run(s), ${String(errors.workflows ?? 0)} workflow(s) with a step pointing at it.`,
      "FUNCTION_DELETE_BLOCKED",
      "Re-run with --force to delete anyway; those workflow steps then fail at their next run.",
      errors
    );
  }
  if (typeof errors?.buildId === "string" && errors.buildId) {
    throw new CliActionableError(
      `The build for ${subject} failed: ${firstErrorMessage(errors) ?? message}`,
      "FUNCTION_BUILD_FAILED",
      `Read the build log with: blocks logic function build ${errors.buildId} --json`,
      errors
    );
  }

  const detail = firstErrorMessage(errors) ?? message;
  switch (status) {
    case 400:
      // Test/ReplayRun answer a refused envelope as `{ code: FUNCTION_FORBIDDEN_CONTENT,
      // message }` -- the only 400 there without an `errors` object. Save refuses a typed
      // credential through the filter, as a validation error naming the credential.
      if (!errors || /credential/i.test(detail)) {
        throw new CliActionableError(detail, "FUNCTION_FORBIDDEN_CONTENT",
          "A credential-looking name must hold a {{secret.<id>}} reference, not a typed value. Create the secret with `blocks secrets create` and reference its id.", errors);
      }
      throw new CliActionableError(detail, "FUNCTION_VALIDATION", undefined, errors);
    case 401:
    case 403:
      throw new CliActionableError(detail, "FUNCTION_FORBIDDEN",
        "The project session needs blocks-logic::function::read (reads) or ::manage (writes).", errors);
    case 404:
      throw new CliActionableError(`${subject} was not found.`, "FUNCTION_NOT_FOUND", undefined, errors);
    case 429:
      throw new CliActionableError(detail, "FUNCTION_RATE_LIMITED", "Wait a moment and retry.", errors);
    case 503:
      throw new CliActionableError(detail, "FUNCTION_UNAVAILABLE", "Nothing ran; the run queue refused it. Retry shortly.", errors);
    default:
      throw new CliActionableError(message, "function_request_failed", undefined, errors);
  }
}

function firstErrorMessage(errors: Record<string, unknown> | undefined): string | undefined {
  if (!errors) return undefined;
  for (const key of ["invalid_request", "not_found", "forbidden", "unauthorized", "rate_limited", "unavailable"]) {
    const value = errors[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

async function call<T>(options: FunctionRequestContext, subject: string, run: () => Promise<T>): Promise<T> {
  try {
    const result = await run();
    if (isRecord(result) && result.isSuccess === false) {
      mapFunctionError(new Error(`Blocks API 400 Bad Request: ${JSON.stringify(result)}`), subject);
    }
    return result;
  } catch (error) {
    mapFunctionError(error, subject);
  }
}

// ------------------------------------------------------------------ requests --

export function listFunctions(options: FunctionRequestContext & {
  search?: string;
  status?: string;
  sortBy?: string;
  page: number;
  pageSize: number;
}): Promise<unknown> {
  return call(options, "Function list", () => blocksRequest<unknown>("/logic/v4/Functions/GetAll", {
    ...apiCtx(options),
    method: "POST",
    body: {
      searchKey: options.search,
      status: options.status,
      sortBy: options.sortBy,
      pageNumber: options.page,
      pageSize: options.pageSize
    }
  }));
}

export function getFunction(options: FunctionRequestContext & { functionId: string }): Promise<Record<string, unknown>> {
  return call(options, `Function '${options.functionId}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Get", {
    ...apiCtx(options),
    method: "GET",
    query: { functionId: options.functionId }
  }));
}

export function createFunction(options: FunctionRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  return call(options, `Function '${String(options.body.name ?? "")}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Create", {
    ...apiCtx(options),
    method: "POST",
    body: options.body
  }));
}

export function updateFunction(options: FunctionRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  return call(options, `Function '${String(options.body.functionId)}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Update", {
    ...apiCtx(options),
    method: "POST",
    body: options.body
  }));
}

export function saveFunction(options: FunctionRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  return call(options, `Function '${String(options.body.functionId)}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Save", {
    ...apiCtx(options),
    method: "POST",
    body: options.body
  }));
}

export async function deleteFunction(options: FunctionRequestContext & { functionId: string; force: boolean }): Promise<Record<string, unknown>> {
  const result = await call(options, `Function '${options.functionId}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Delete", {
    ...apiCtx(options),
    method: "DELETE",
    query: { functionId: options.functionId, force: options.force }
  }));
  return { functionId: options.functionId, deleted: isRecord(result) ? result.isSuccess !== false : true, force: options.force };
}

export function testFunction(options: FunctionRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  return call(options, `Function '${String(options.body.functionId)}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Test", {
    ...apiCtx(options),
    method: "POST",
    body: options.body
  }));
}

/**
 * `Functions/Deploy` answers 200 with the new version when the image is ready, or 202
 * with `{ buildId, status }` while it is still building. `blocksRequest` hides the status
 * code, so the two are told apart by shape: only the version carries `number`.
 */
export function deployFunctionOnce(options: FunctionRequestContext & { body: Record<string, unknown> }): Promise<Record<string, unknown>> {
  return call(options, `Function '${String(options.body.functionId)}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/Deploy", {
    ...apiCtx(options),
    method: "POST",
    body: options.body
  }));
}

export function isPendingDeploy(result: Record<string, unknown>): boolean {
  return typeof result.buildId === "string" && result.number === undefined;
}

export function getBuild(options: FunctionRequestContext & { buildId: string }): Promise<Record<string, unknown>> {
  return call(options, `Build '${options.buildId}'`, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/GetBuild", {
    ...apiCtx(options),
    method: "GET",
    query: { buildId: options.buildId }
  }));
}

/**
 * Deploy, and when the build is still running, watch it and deploy exactly that build
 * once it succeeds -- the same two steps the Studio takes. `wait: false` returns the
 * pending `{ buildId, status }` instead.
 */
export async function deployFunction(options: FunctionRequestContext & {
  functionId: string;
  note?: string;
  rebuild: boolean;
  buildId?: string;
  wait: boolean;
  timeoutSeconds: number;
  pollIntervalMs?: number;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = { functionId: options.functionId, rebuild: options.rebuild };
  if (options.note) body.note = options.note;
  if (options.buildId) body.buildId = options.buildId;

  const first = await deployFunctionOnce({ ...options, body });
  if (!isPendingDeploy(first)) return { deployed: true, version: first };
  if (!options.wait) return { deployed: false, buildId: first.buildId, status: first.status };

  const buildId = String(first.buildId);
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  const interval = options.pollIntervalMs ?? 3000;
  for (;;) {
    const build = await getBuild({ ...options, buildId });
    const status = String(build.status ?? "");
    if (status === BUILD_TERMINAL_OK) break;
    if (status === BUILD_TERMINAL_FAILED) {
      throw new CliActionableError(
        `The build for function '${options.functionId}' failed${typeof build.errorMessage === "string" && build.errorMessage ? `: ${build.errorMessage}` : "."}`,
        "FUNCTION_BUILD_FAILED",
        `Read the build log with: blocks logic function build ${buildId} --json`
      );
    }
    if (Date.now() >= deadline) {
      throw new CliActionableError(
        `Build ${buildId} is still ${status || "running"} after ${options.timeoutSeconds}s; nothing was deployed.`,
        "FUNCTION_BUILD_PENDING",
        `Check it with \`blocks logic function build ${buildId}\`, then deploy it with \`blocks logic function deploy ${options.functionId} --build-id ${buildId} --yes\`.`
      );
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, interval));
  }

  const second = await deployFunctionOnce({ ...options, body: { ...body, buildId } });
  if (isPendingDeploy(second)) {
    return { deployed: false, buildId: second.buildId, status: second.status };
  }
  return { deployed: true, buildId, version: second };
}

export function getFunctionResource(options: FunctionRequestContext & {
  action: "GetVersions" | "GetVersionSource" | "GetRuns" | "GetRun" | "GetRunLogs" | "GetAuditLog" | "GetLimits";
  subject: string;
  query?: Record<string, string | number | boolean | undefined>;
}): Promise<unknown> {
  switch (options.action) {
    case "GetVersions":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetVersions", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetVersionSource":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetVersionSource", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetRuns":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetRuns", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetRun":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetRun", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetRunLogs":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetRunLogs", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetAuditLog":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetAuditLog", { ...apiCtx(options), method: "GET", query: options.query }));
    case "GetLimits":
      return call(options, options.subject, () => blocksRequest<unknown>("/logic/v4/Functions/GetLimits", { ...apiCtx(options), method: "GET" }));
  }
}

export function runAction(options: FunctionRequestContext & { action: "ReplayRun" | "CancelRun"; runId: string }): Promise<Record<string, unknown>> {
  const subject = `Run '${options.runId}'`;
  if (options.action === "ReplayRun") {
    return call(options, subject, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/ReplayRun", {
      ...apiCtx(options),
      method: "POST",
      body: { runId: options.runId }
    }));
  }
  return call(options, subject, () => blocksRequest<Record<string, unknown>>("/logic/v4/Functions/CancelRun", {
    ...apiCtx(options),
    method: "POST",
    body: { runId: options.runId }
  }));
}

// -------------------------------------------------------------------- flags --

export function requireId(id: string | undefined, label: string, code: string, usage: string): string {
  if (!id || !id.trim()) throw new CliActionableError(`Missing ${label}.`, code, `Usage: ${usage}`);
  return id.trim();
}

/** Logic lists page from 0 (`Skip(pageNumber * pageSize)`), like the proxy commands. */
export function parseFunctionPaging(flags: Flags, defaultSize: number, maxSize = 200): { page: number; pageSize: number } {
  const page = integerFlag(flags, "page", 0);
  if (page < 0) throw new Error("--page must be greater than or equal to 0");
  const pageSize = integerFlag(flags, "page-size", defaultSize);
  if (pageSize < 1 || pageSize > maxSize) throw new Error(`--page-size must be between 1 and ${maxSize}`);
  return { page, pageSize };
}

/** Case-insensitive match against a fixed vocabulary, returning the server's spelling. */
export function pickOne(raw: string, allowed: readonly string[], flag: string, code: string): string {
  const match = allowed.find((value) => value.toLowerCase() === raw.trim().toLowerCase());
  if (!match) {
    throw new CliActionableError(`--${flag} must be one of: ${allowed.join(", ")} (got '${raw}').`, code);
  }
  return match;
}

/** Every value of a repeatable flag (`--var A=1 --var B=2`); parseFlags keeps only the last. */
export function collectRepeated(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === `--${name}`) {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        values.push(next);
        i += 1;
      }
    } else if (token.startsWith(`--${name}=`)) {
      values.push(token.slice(name.length + 3));
    }
  }
  return values;
}

export function parseVariablePairs(raw: string[]): Array<{ key: string; value: string }> {
  return raw.map((entry) => {
    const eq = entry.indexOf("=");
    if (eq <= 0) {
      throw new CliActionableError(`--var must be KEY=VALUE (got '${entry}').`, "FUNCTION_VALIDATION");
    }
    return { key: entry.slice(0, eq).trim(), value: entry.slice(eq + 1) };
  });
}

async function readText(path: string, label: string): Promise<string> {
  try {
    const text = await readFile(path, "utf8");
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch (error) {
    throw new CliActionableError(
      `Cannot read ${label} ${path}: ${error instanceof Error ? error.message : String(error)}`,
      "function_file_unreadable"
    );
  }
}

async function readOptionalText(path: string): Promise<string | undefined> {
  try {
    const text = await readFile(path, "utf8");
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

function parseJsonObject(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CliActionableError(`${label} is not valid JSON: ${(error as Error).message}`, "function_file_invalid");
  }
  if (!isRecord(parsed)) throw new CliActionableError(`${label} must contain a JSON object.`, "function_file_invalid");
  return parsed;
}

/**
 * The configuration half of a function that `function.json` carries: everything
 * `Functions/Save` takes apart from the source files. Limits and retry are fixed by the
 * platform (only `limits.requestsPerMinute` is the tenant's), so only that is kept.
 */
export function configOf(detail: Record<string, unknown>): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (typeof detail.name === "string") config.name = detail.name;
  if (typeof detail.description === "string") config.description = detail.description;
  config.allowInstallScripts = detail.allowInstallScripts === true;
  if (detail.trigger !== undefined) config.trigger = detail.trigger;
  config.outputActions = detail.outputActions ?? [];
  config.variables = detail.variables ?? [];
  const limits = isRecord(detail.limits) ? detail.limits : {};
  config.limits = { requestsPerMinute: limits.requestsPerMinute ?? null };
  return config;
}

export type SaveSources = {
  indexJs?: string;
  packageJson?: string;
  lockJson?: string | null;
  config?: Record<string, unknown>;
};

/** Reads `--dir` (index.js, package.json, optional package-lock.json / function.json) and the single-file flags. */
export async function readSaveSources(flags: Flags): Promise<SaveSources> {
  const sources: SaveSources = {};
  const dir = stringFlag(flags, "dir");
  if (dir) {
    sources.indexJs = await readText(join(dir, FUNCTION_DIR_FILES.index), "--dir entry point");
    sources.packageJson = await readText(join(dir, FUNCTION_DIR_FILES.package), "--dir manifest");
    const lock = await readOptionalText(join(dir, FUNCTION_DIR_FILES.lock));
    if (lock !== undefined) sources.lockJson = lock;
    const config = await readOptionalText(join(dir, FUNCTION_DIR_FILES.config));
    if (config !== undefined) sources.config = parseJsonObject(config, `${join(dir, FUNCTION_DIR_FILES.config)}`);
  }

  const indexFile = stringFlag(flags, "index-file");
  if (indexFile) sources.indexJs = await readText(indexFile, "--index-file");
  const packageFile = stringFlag(flags, "package-file");
  if (packageFile) sources.packageJson = await readText(packageFile, "--package-file");
  const lockFile = stringFlag(flags, "lock-file");
  if (lockFile) sources.lockJson = await readText(lockFile, "--lock-file");
  if (booleanFlag(flags, "no-lock")) sources.lockJson = null;
  const configFile = stringFlag(flags, "config-file");
  if (configFile) sources.config = parseJsonObject(await readText(configFile, "--config-file"), `--config-file ${configFile}`);
  return sources;
}

/**
 * Builds the `Functions/Save` body. Save replaces the whole working copy -- source and
 * every piece of configuration -- so the body starts from the stored function and
 * layers, in order: a `function.json`/`--config-file`, the source files, then the
 * convenience flags. Anything not supplied keeps its stored value.
 */
export function buildSaveBody(
  functionId: string,
  current: Record<string, unknown>,
  sources: SaveSources,
  flags: Flags,
  variablePairs: Array<{ key: string; value: string }>
): Record<string, unknown> {
  const config = sources.config ?? {};
  const pick = (key: string): unknown => (config[key] !== undefined ? config[key] : current[key]);

  const trigger: Record<string, unknown> = { ...(isRecord(current.trigger) ? current.trigger : {}), ...(isRecord(config.trigger) ? config.trigger : {}) };
  const limits: Record<string, unknown> = { ...(isRecord(current.limits) ? current.limits : {}), ...(isRecord(config.limits) ? config.limits : {}) };

  const methods = listFlag(flags, "http-methods");
  if (methods) {
    trigger.httpMethods = methods.map((method) => pickOne(method, FUNCTION_HTTP_METHODS, "http-methods", "FUNCTION_VALIDATION"));
  }
  const auth = stringFlag(flags, "auth");
  if (auth) trigger.authMode = pickOne(auth, ["Public", "Token"], "auth", "FUNCTION_VALIDATION");
  const roles = listFlag(flags, "roles");
  if (roles) trigger.roles = roles;
  const permissions = listFlag(flags, "permissions");
  if (permissions) trigger.permissions = permissions;
  const responseMode = stringFlag(flags, "response-mode");
  if (responseMode) trigger.responseMode = pickOne(responseMode, ["async", "sync"], "response-mode", "FUNCTION_VALIDATION");
  const httpEnabled = optionalBooleanFlag(flags, "http-enabled");
  if (httpEnabled !== undefined) trigger.httpEnabled = httpEnabled;
  const workflowEnabled = optionalBooleanFlag(flags, "workflow-enabled");
  if (workflowEnabled !== undefined) trigger.workflowEnabled = workflowEnabled;

  const rpmRaw = stringFlag(flags, "requests-per-minute");
  if (rpmRaw) {
    if (rpmRaw === "default") {
      limits.requestsPerMinute = null;
    } else {
      const rpm = optionalIntegerFlag(flags, "requests-per-minute");
      if (rpm === undefined || rpm < 1 || rpm > 100_000) {
        throw new CliActionableError("--requests-per-minute must be 1..100000, or 'default'.", "FUNCTION_VALIDATION");
      }
      limits.requestsPerMinute = rpm;
    }
  }
  // Per day is refused on save; the stored value only ever deserializes old documents.
  delete limits.requestsPerDay;

  let variables = pick("variables");
  if (variablePairs.length > 0) {
    const merged = new Map<string, string>();
    for (const entry of Array.isArray(variables) ? variables : []) {
      if (isRecord(entry) && typeof entry.key === "string") merged.set(entry.key, String(entry.value ?? ""));
    }
    for (const { key, value } of variablePairs) merged.set(key, value);
    variables = [...merged].map(([key, value]) => ({ key, value }));
  }
  for (const key of collectUnsetKeys(flags)) {
    variables = (Array.isArray(variables) ? variables : []).filter((entry) => !(isRecord(entry) && entry.key === key));
  }

  const allowInstallScripts = optionalBooleanFlag(flags, "allow-install-scripts");

  const body: Record<string, unknown> = {
    functionId,
    indexJs: sources.indexJs ?? current.indexJs ?? "",
    packageJson: sources.packageJson ?? current.packageJson ?? "",
    lockJson: sources.lockJson === null ? null : sources.lockJson ?? current.lockJson ?? null,
    allowInstallScripts: allowInstallScripts ?? (pick("allowInstallScripts") === true),
    limits,
    retry: isRecord(current.retry) ? current.retry : {},
    trigger,
    outputActions: pick("outputActions") ?? [],
    variables: variables ?? []
  };
  return body;
}

function collectUnsetKeys(flags: Flags): string[] {
  return listFlag(flags, "unset-var") ?? [];
}

/** True when a save request carries nothing new: no files, no config, no flags. */
export function saveHasChanges(sources: SaveSources, flags: Flags, variablePairs: unknown[]): boolean {
  if (sources.indexJs !== undefined || sources.packageJson !== undefined || sources.lockJson !== undefined || sources.config) return true;
  if (variablePairs.length > 0) return true;
  const flagNames = [
    "http-methods", "auth", "roles", "permissions", "response-mode", "http-enabled",
    "workflow-enabled", "requests-per-minute", "allow-install-scripts", "unset-var"
  ];
  return flagNames.some((name) => name in flags);
}

/** The public invoke URL for a function, on the account's API host. */
export async function functionInvokeUrl(flags: Flags, functionId: string, routePath?: string): Promise<string> {
  const config = await readConfig();
  const ctx = requestContext(flags);
  const { profile } = await resolveAccountProfile(config, ctx.accountName);
  const base = (ctx.apiUrl ?? profile.apiUrl).replace(/\/+$/, "");
  const suffix = (routePath ?? "").replace(/^\/+|\/+$/g, "");
  const root = `${base}${LOGIC_FUNCTION_INVOKE_PREFIX}/${encodeURIComponent(functionId)}`;
  return suffix ? `${root}/${suffix}` : root;
}
