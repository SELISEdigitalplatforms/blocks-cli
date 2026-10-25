import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authOidcClientsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/oidc-clients", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  // IAM no longer returns client_secret on list/get. Redact anyway, as a second guard
  // against an older IAM: this output is routinely pasted into issues and CI logs.
  // Use 'auth oidc-clients rotate-secret' to obtain a working secret.
  writeOutput(redactSecrets(result), flags);
}
