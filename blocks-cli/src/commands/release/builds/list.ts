import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, ReleaseEnvelope, ReleaseRepo, repoIdOf, repoSummary, resolveRepoSelection } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type RepoDetailsData = {
  repo?: ReleaseRepo;
  build?: Array<Record<string, unknown>>;
  totalCount?: number;
};

export async function releaseBuildsList(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const selector = args[0] || stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const branch = stringFlag(flags, "branch");
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  const pageSize = integerFlag(flags, "page-size", 30);
  if (pageSize < 1) throw new Error("--page-size must be greater than or equal to 1");

  const projectKey = await selectedProject(flags);
  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  const result = await blocksRequest<ReleaseEnvelope<RepoDetailsData>>(`${RELEASE_API}/Build/repo-details`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: {
      RepoId: repoId,
      branch: branch || undefined,
      pageNumber: page,
      pageSize
    },
    ...requestContext(flags)
  });

  const data = result?.data;
  writeOutput(
    {
      builds: (data?.build ?? []).map((build) => buildRow(build)),
      page,
      pageSize,
      repo: repoSummary(data?.repo ?? repo),
      totalCount: data?.totalCount ?? undefined
    },
    flags
  );
}

function buildRow(build: Record<string, unknown>): Record<string, unknown> {
  return {
    branch: build.branch,
    buildId: build.itemId ?? build.id,
    commit: build.commit,
    createdDate: build.createdDate ?? build.createDate ?? build.createdAt,
    duration: build.duration,
    status: build.status
  };
}
