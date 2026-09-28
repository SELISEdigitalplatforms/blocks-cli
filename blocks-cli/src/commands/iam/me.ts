import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { optionalSelectedProject, parseCommand } from "../../lib/workspace.js";

export async function iamMe(argv: string[] = []): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await optionalSelectedProject(flags);
  // The server resets to the root tenant's identity for this endpoint
  // regardless of which token calls it, so the impersonated project session
  // works fine here too -- prefer it when a project is selected.
  const me = await blocksRequest<unknown>("/iam/v4/iam/me", {
    preferImpersonatedProjectAuth: true,
    projectTenantId,
    ...requestContext(flags)
  });

  writeOutput(me, { ...flags, json: true });
}
