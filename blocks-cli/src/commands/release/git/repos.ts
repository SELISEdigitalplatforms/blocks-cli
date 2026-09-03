import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, requireSupportedGitProvider } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Browses repositories of the connected source-control account. Generic on purpose:
 * --provider names the VCS, and only 'github' is live in blocks-release today, so
 * other values fail with provider_not_supported instead of a confusing 404.
 */
export async function releaseGitRepos(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  requireSupportedGitProvider(stringFlag(flags, "provider", { defaultValue: "github" }));
  const search = stringFlag(flags, "search");
  const page = integerFlag(flags, "page", 1);
  if (page < 1) throw new Error("--page must be greater than or equal to 1");
  const pageSize = integerFlag(flags, "page-size", 30);
  if (pageSize < 1) throw new Error("--page-size must be greater than or equal to 1");

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${RELEASE_API}/Github/repos`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { PageNumber: page, PageSize: pageSize, Search: search || undefined },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
