import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { repoIdOf, resolveRepoSelection } from "../../../lib/release.js";
import { syncSecretsFromFile } from "../../../lib/release-secrets.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Bulk env-var upsert from a dotenv file. The server stores one whole secret set per
 * repo (RepoSecret/save replaces the set), so merge mode reads the current set first
 * (an audited read, same as the portal's reveal) and removals only happen with --prune.
 * Key NAMES are the only secret-adjacent thing this command ever prints. The sync
 * itself lives in lib/release-secrets.ts so 'release deploy --with-secrets' can run it
 * as a step and fold the summary into its own single stdout document.
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

  const result = await syncSecretsFromFile({
    confirm: (summary) =>
      confirmMutation(
        flags,
        `Save secrets for repo '${repo.repoName ?? repoId}': add ${summary.added.length}, update ${summary.updated.length}, remove ${summary.removed.length} (values are never displayed).`
      ),
    dryRun,
    file,
    flags,
    projectKey,
    prune,
    repoId
  });
  writeOutput(result, flags);
}
