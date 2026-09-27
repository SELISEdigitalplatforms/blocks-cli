import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authIdpList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/auth/identity-providers", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  // Identity providers store the OIDC client secret verbatim and return it on
  // every read -- redact it here for the same reason oidc-clients list/get do:
  // this output is routinely pasted into issues and CI logs.
  writeOutput(redactSecrets(result), flags);
}
