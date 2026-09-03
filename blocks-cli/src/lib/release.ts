import { blocksRequest } from "./api.js";
import { CliActionableError } from "./errors.js";
import { requestContext } from "./request-context.js";

export const RELEASE_API = "/release/v4/api";

type Flags = Record<string, string | boolean>;

// Server envelope: BaseApiResponse { data, isSuccess, message, statusCode } (camelCase).
export type ReleaseEnvelope<T> = {
  data?: T;
  isSuccess?: boolean;
  message?: string;
} & Record<string, unknown>;

export type ReleaseRepo = {
  itemId?: string;
  id?: string;
  repoName?: string;
  repoUrl?: string;
  branch?: string;
  commit?: string;
  deploymentType?: string;
  defaultDeploymentUrl?: string;
  customDeploymentUrl?: string;
  deployedNamespace?: string;
  lastDeploymentDate?: string;
  lastDeploymentStatus?: string;
  isArchived?: boolean;
} & Record<string, unknown>;

export type ReleaseBuildEvent = {
  id?: string;
  buildId?: string;
  eventType?: string;
  eventGroup?: string;
  message?: string;
  createdAt?: string;
} & Record<string, unknown>;

export function repoIdOf(repo: ReleaseRepo): string | undefined {
  return firstNonEmptyString(repo, ["itemId", "id", "repoId"]);
}

export function repoSummary(repo: ReleaseRepo): Record<string, unknown> {
  return {
    archived: repo.isArchived === true ? true : undefined,
    branch: repo.branch,
    deploymentType: repo.deploymentType,
    lastDeploymentDate: repo.lastDeploymentDate,
    lastDeploymentStatus: repo.lastDeploymentStatus,
    name: repo.repoName,
    namespace: repo.deployedNamespace || undefined,
    repoId: repoIdOf(repo),
    repoUrl: repo.repoUrl,
    url: repo.customDeploymentUrl || repo.defaultDeploymentUrl || undefined
  };
}

export async function listReleaseRepos(projectKey: string, flags: Flags): Promise<ReleaseRepo[]> {
  const result = await blocksRequest<ReleaseEnvelope<ReleaseRepo[]>>(`${RELEASE_API}/Build/repos-list`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  const repos = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? (result as unknown as ReleaseRepo[]) : [];
  return repos;
}

/**
 * Resolves one blocks-release repo by name or id from Build/repos-list. Accepting a
 * name saves callers (humans and agents alike) a separate lookup round-trip for the id.
 */
export async function resolveRepoBySelector(selector: string, projectKey: string, flags: Flags): Promise<ReleaseRepo> {
  const repos = await listReleaseRepos(projectKey, flags);
  if (repos.length === 0) throw noRepoError();

  const wanted = selector.toLowerCase();
  const matches = repos.filter(
    (repo) => repoIdOf(repo)?.toLowerCase() === wanted || repo.repoName?.toLowerCase() === wanted
  );

  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    throw new CliActionableError(
      `No repo named or id'd '${selector}' is registered for this project. Available: ${repoChoices(repos)}.`,
      "repo_not_found",
      "Pass --repo with one of the listed names or ids, or run 'blocks release repos list' to inspect them."
    );
  }
  throw new CliActionableError(
    `'${selector}' matches more than one repo: ${matches.map((repo) => repoIdOf(repo)).join(", ")}.`,
    "repo_ambiguous",
    "Pass --repo with the exact repo id instead of the name."
  );
}

/**
 * Picks the repo for a command: an explicit selector (name or id) when given, else the
 * single registered repo. Multiple repos with no selector fail with the candidates
 * listed -- never an interactive prompt, so agents get a typed error instead of a hang.
 */
export async function resolveRepoSelection(
  selector: string | undefined,
  projectKey: string,
  flags: Flags
): Promise<ReleaseRepo> {
  if (selector) return resolveRepoBySelector(selector, projectKey, flags);

  const repos = await listReleaseRepos(projectKey, flags);
  if (repos.length === 1) return repos[0];
  if (repos.length === 0) throw noRepoError();
  throw new CliActionableError(
    `Multiple repos are registered for this project: ${repoChoices(repos)}.`,
    "repo_ambiguous",
    "Pass --repo <name|id> to pick one."
  );
}

function noRepoError(): CliActionableError {
  return new CliActionableError(
    "No repositories are registered in blocks-release for this project.",
    "repo_not_linked",
    "Link a repo from the Blocks portal (requires GitHub auth), then re-run this command."
  );
}

function repoChoices(repos: ReleaseRepo[]): string {
  return repos.map((repo) => `${repo.repoName ?? "(unnamed)"} (${repoIdOf(repo) ?? "?"})`).join(", ");
}

// The server's own terminal-status vocabulary (PipeLineTaskConstants.TermialStatus and
// EventStatus in blocks-release), matched against the status FIELD only -- never by
// keyword-scanning arbitrary strings, where a commit message like "fix error handling"
// would read as a terminal build.
const SUCCESS_STATUSES = new Set(["succeeded", "success", "completed"]);
const FAILURE_STATUSES = new Set([
  "failed",
  "error",
  "cancelled",
  "cancelledrunfinally",
  "stoppedrunfinally",
  "pipelinerunstopping",
  "pipelineruncancelled",
  "pipelineruncouldntcancel",
  "pipelineruntimeout",
  "timeout",
  "deleted"
]);

export type BuildVerdict = "succeeded" | "failed" | "running";

export function classifyBuildStatus(status: string | undefined): BuildVerdict {
  const normalized = (status ?? "").toLowerCase();
  if (SUCCESS_STATUSES.has(normalized)) return "succeeded";
  if (FAILURE_STATUSES.has(normalized)) return "failed";
  return "running";
}

export function buildStatusOf(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const direct = record.status;
  if (typeof direct === "string" && direct) return direct;
  for (const key of ["data", "build"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const found = buildStatusOf(nested);
      if (found) return found;
    }
  }
  return undefined;
}

export function buildEventsOf(payload: unknown): ReleaseBuildEvent[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.events)) return record.events as ReleaseBuildEvent[];
  for (const key of ["data", "build"]) {
    const nested = record[key];
    if (nested && typeof nested === "object") {
      const found = buildEventsOf(nested);
      if (found.length > 0) return found;
    }
  }
  return [];
}

export async function getBuild(buildId: string, projectKey: string, flags: Flags): Promise<unknown> {
  return blocksRequest<unknown>(`${RELEASE_API}/Build`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { buildId },
    ...requestContext(flags)
  });
}

export function formatBuildEvent(event: ReleaseBuildEvent): string {
  const group = event.eventGroup ? `[${event.eventGroup}] ` : "";
  const type = event.eventType && event.eventType !== "Log" ? `(${event.eventType}) ` : "";
  return `${group}${type}${event.message ?? ""}`.trimEnd();
}

export const DEFAULT_POLL_INTERVAL_SECONDS = 10;
export const DEFAULT_WAIT_TIMEOUT_SECONDS = 900;

export type WaitOptions = {
  followLogs?: boolean;
  onEvent?: (line: string) => void;
  pollIntervalSeconds: number;
  timeoutSeconds: number;
};

export type WaitResult = { build: unknown; status: string | undefined; verdict: BuildVerdict };

/**
 * Polls GET Build until the status FIELD reaches a terminal value. All progress --
 * the waiting banner, per-poll status, and (with followLogs) new build events -- goes
 * to stderr, so stdout stays a single parseable document for --json callers.
 */
export async function waitForBuild(
  buildId: string,
  projectKey: string,
  flags: Flags,
  options: WaitOptions
): Promise<WaitResult> {
  if (options.pollIntervalSeconds < 0) throw new Error("--poll-interval must be zero or greater");
  if (options.timeoutSeconds <= 0) throw new Error("--timeout must be greater than zero");

  const deadline = Date.now() + options.timeoutSeconds * 1000;
  const emit = options.onEvent ?? ((line: string) => console.error(line));
  const seenEvents = new Set<string>();
  let lastStatus: string | undefined;

  console.error(
    `Waiting for build '${buildId}' (polling every ${options.pollIntervalSeconds}s, timeout ${options.timeoutSeconds}s)...`
  );

  while (true) {
    const build = await getBuild(buildId, projectKey, flags);
    const status = buildStatusOf(build);

    if (options.followLogs) {
      for (const event of buildEventsOf(build)) {
        const key = typeof event.id === "string" && event.id ? event.id : JSON.stringify(event);
        if (seenEvents.has(key)) continue;
        seenEvents.add(key);
        emit(formatBuildEvent(event));
      }
    }

    if (status && status !== lastStatus) {
      lastStatus = status;
      console.error(`status: ${status}`);
    }

    const verdict = classifyBuildStatus(status);
    if (verdict !== "running") return { build, status, verdict };

    if (Date.now() >= deadline) {
      throw new CliActionableError(
        `Timed out after ${options.timeoutSeconds}s waiting for build '${buildId}' to reach a terminal status (last status: ${status ?? "unknown"}).`,
        "build_wait_timeout",
        `Check manually with 'blocks release status ${buildId}' or keep watching with 'blocks release status ${buildId} --wait'.`
      );
    }

    await delay(options.pollIntervalSeconds * 1000);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function firstNonEmptyString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}

/**
 * Minimal dotenv parser for 'release secrets sync'. Handles comments, blank lines,
 * an optional `export ` prefix, and single/double-quoted values. No dependency on a
 * dotenv package -- keeps the CLI's dependency surface unchanged.
 */
export function parseDotenv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) continue;
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trimEnd();
    }
    values[key] = value;
  }
  return values;
}

/** Only 'github' is live in blocks-release today; the portal lists others as inactive. */
export function requireSupportedGitProvider(provider: string): string {
  const normalized = (provider || "github").toLowerCase();
  if (normalized !== "github") {
    throw new CliActionableError(
      `Git provider '${normalized}' is not supported by blocks-release yet -- only 'github' is active.`,
      "provider_not_supported",
      "Re-run with --provider github (or omit --provider)."
    );
  }
  return normalized;
}
