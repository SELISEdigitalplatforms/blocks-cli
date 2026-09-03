import { readFile } from "node:fs/promises";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, ReleaseEnvelope, parseDotenv, repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Bulk env-var upsert from a dotenv file. The server stores one whole secret set per
 * repo (RepoSecret/save replaces the set), so merge mode reads the current set first
 * (an audited read, same as the portal's reveal) and removals only happen with --prune.
 * Key NAMES are the only secret-adjacent thing this command ever prints.
 */
export async function releaseSecretsSync(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const file = stringFlag(flags, "file", { defaultValue: ".env" });
  const selector = stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const prune = booleanFlag(flags, "prune");
  const dryRun = booleanFlag(flags, "dry-run");

  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

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

  const summary = {
    added,
    file,
    mode: prune ? "replace" : "merge",
    removed,
    repoId,
    totalAfterSave: Object.keys(merged).length,
    unchanged: unchanged.length,
    updated
  };

  if (dryRun) {
    writeOutput({ ...summary, dryRun: true }, flags);
    return;
  }

  if (added.length === 0 && updated.length === 0 && removed.length === 0) {
    writeOutput({ ...summary, saved: false, upToDate: true }, flags);
    return;
  }

  await confirmMutation(
    flags,
    `Save secrets for repo '${repo.repoName ?? repoId}': add ${added.length}, update ${updated.length}, remove ${removed.length} (values are never displayed).`
  );

  await blocksRequest<unknown>(`${RELEASE_API}/RepoSecret/save`, {
    body: { repoId, secrets: merged },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  writeOutput({ ...summary, saved: true }, flags);
}

async function readCurrentSecrets(
  repoId: string,
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<Record<string, string>> {
  try {
    const result = await blocksRequest<ReleaseEnvelope<unknown>>(`${RELEASE_API}/RepoSecret/value`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      query: { repoId },
      ...requestContext(flags)
    });
    const data = result?.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
        if (typeof value === "string") flat[key] = value;
      }
      return flat;
    }
    return {};
  } catch {
    // No secret set exists yet (or it is soft-deleted) -- start from empty.
    return {};
  }
}
