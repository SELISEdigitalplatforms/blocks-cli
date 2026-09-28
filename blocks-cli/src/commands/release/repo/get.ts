import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import {
  RELEASE_API,
  ReleaseEnvelope,
  ReleaseRepo,
  repoIdOf,
  repoSummary,
  resolveRepoSelection
} from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type RepoDetailsData = {
  repo?: ReleaseRepo;
  build?: Array<Record<string, unknown>>;
  totalCount?: number;
};

/** One repo's details plus its most recent builds, addressed by name or id. */
export async function releaseRepoGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const selector = args[0] || stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  const result = await blocksRequest<ReleaseEnvelope<RepoDetailsData>>(`${RELEASE_API}/Build/repo-details`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { RepoId: repoId, pageNumber: 1, pageSize: 5 },
    ...requestContext(flags)
  });

  const data = result?.data;
  writeOutput(
    {
      recentBuilds: (data?.build ?? []).map((build) => ({
        branch: build.branch,
        buildId: build.itemId ?? build.id,
        commit: build.commit,
        duration: build.duration,
        status: build.status
      })),
      repo: repoSummary(data?.repo ?? repo),
      totalBuilds: data?.totalCount ?? undefined
    },
    flags
  );
}
