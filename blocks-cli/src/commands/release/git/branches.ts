import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, requireSupportedGitProvider } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Lists branches of one source repository (e.g. 'owner/name' for GitHub). */
export async function releaseGitBranches(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  requireSupportedGitProvider(stringFlag(flags, "provider", { defaultValue: "github" }));
  const repo = args[0] || stringFlag(flags, "source-repo", { required: true });

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${RELEASE_API}/Github/branches`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { repo },
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
