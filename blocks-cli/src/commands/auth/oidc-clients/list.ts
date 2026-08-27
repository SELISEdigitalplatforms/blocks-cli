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
  // IAM documents client_secret as excluded from list/get, but returns the stored
  // registration verbatim -- so the secret comes back in full on every read. Until the
  // service stops sending it, redact here: this output is routinely pasted into issues
  // and CI logs, and public PKCE clients have no legitimate use for a secret at all.
  // Use 'auth oidc-clients rotate-secret' to obtain a working secret.
  writeOutput(redactSecrets(result), flags);
}
