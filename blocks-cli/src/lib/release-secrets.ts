import { readFile } from "node:fs/promises";
import { blocksRequest } from "./api.js";
import { CliActionableError } from "./errors.js";
import { RELEASE_API, ReleaseEnvelope, parseDotenv } from "./release.js";
import { requestContext } from "./request-context.js";

type Flags = Record<string, string | boolean>;

export type SecretsSyncSummary = {
  added: string[];
  file: string;
  mode: "merge" | "replace";
  removed: string[];
  repoId: string;
  totalAfterSave: number;
  unchanged: number;
  updated: string[];
};

export type SecretsSyncResult = SecretsSyncSummary & { dryRun?: true; saved?: boolean; upToDate?: true };

/**
 * Bulk env-var upsert from a dotenv file into one repo's secret set, shared by
 * 'release secrets sync' and 'release deploy --with-secrets'. The server stores one
 * whole set per repo (RepoSecret/save REPLACES it), so merge mode reads the current set
 * first -- an audited read, same as the portal's reveal -- and removals only happen with
 * prune. Returns the plan/result without printing; key NAMES are the only secret-adjacent
 * thing in it.
 */
export async function syncSecretsFromFile(options: {
  confirm?: (summary: SecretsSyncSummary) => Promise<void>;
  dryRun?: boolean;
  file: string;
  flags: Flags;
  projectKey: string;
  prune?: boolean;
  repoId: string;
}): Promise<SecretsSyncResult> {
  const { file, flags, projectKey, repoId } = options;
  const prune = options.prune === true;

  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    throw new CliActionableError(
      `Could not read secrets file '${file}': ${(error as Error).message}`,
      "secrets_file_unreadable",
      "Pass --file <path> pointing at a dotenv-format file (KEY=value per line)."
    );
  }

  const fileValues = parseDotenv(content);
  const fileKeys = Object.keys(fileValues);
  if (fileKeys.length === 0) {
    throw new CliActionableError(
      `'${file}' contains no KEY=value lines.`,
      "secrets_file_empty",
      "Check the file path and its dotenv format (KEY=value per line, # for comments)."
    );
  }

  const current = await readCurrentSecrets(repoId, projectKey, flags);
  const currentKeys = Object.keys(current);

  const added = fileKeys.filter((key) => !(key in current)).sort();
  const updated = fileKeys.filter((key) => key in current && current[key] !== fileValues[key]).sort();
  const unchanged = fileKeys.filter((key) => key in current && current[key] === fileValues[key]).sort();
  const removed = prune ? currentKeys.filter((key) => !(key in fileValues)).sort() : [];

  const merged = prune ? { ...fileValues } : { ...current, ...fileValues };

  const summary: SecretsSyncSummary = {
    added,
    file,
    mode: prune ? "replace" : "merge",
    removed,
    repoId,
    totalAfterSave: Object.keys(merged).length,
    unchanged: unchanged.length,
    updated
  };

  if (options.dryRun) return { ...summary, dryRun: true };

  if (added.length === 0 && updated.length === 0 && removed.length === 0) {
    return { ...summary, saved: false, upToDate: true };
  }

  if (options.confirm) await options.confirm(summary);

  await blocksRequest<unknown>(`${RELEASE_API}/RepoSecret/save`, {
    body: { repoId, secrets: merged },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  return { ...summary, saved: true };
}

/**
 * The current set, or empty when the repo has never had one. Only the server's
 * not-found answer (404, SecretExceptionFilter mapping SecretNotFoundException /
 * NO_SECRET_FOR_REPO) means "start from empty" -- any other failure (auth, vault
 * unavailable, soft-deleted set) is re-thrown, because RepoSecret/save REPLACES the
 * whole set: merging over a set we could not read would silently wipe every key
 * that is not in the file.
 */
async function readCurrentSecrets(repoId: string, projectKey: string, flags: Flags): Promise<Record<string, string>> {
  let result: ReleaseEnvelope<unknown> | undefined;
  try {
    result = await blocksRequest<ReleaseEnvelope<unknown>>(`${RELEASE_API}/RepoSecret/value`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      query: { repoId },
      ...requestContext(flags)
    });
  } catch (error) {
    const message = (error as Error).message ?? "";
    if (/^Blocks API 404\b/.test(message) || message.includes("NO_SECRET_FOR_REPO")) return {};
    throw new CliActionableError(
      `Could not read the current secret set of repo '${repoId}' (${message}). Nothing was saved.`,
      "secrets_read_failed",
      "Saving replaces the whole set, so the current one must be readable first. If the set was soft-deleted, run 'blocks release secrets restore' first; otherwise retry once the error above is resolved."
    );
  }

  // RepoSecretValueResponse is { repoId, secretId, secrets: {KEY: value} }. Only the
  // nested map is the set -- reading the envelope itself would merge repoId/secretId
  // in as secret keys.
  const data = result?.data as { secrets?: unknown } | undefined;
  const secrets = data?.secrets;
  if (!secrets || typeof secrets !== "object" || Array.isArray(secrets)) return {};
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(secrets as Record<string, unknown>)) {
    if (typeof value === "string") flat[key] = value;
  }
  return flat;
}
