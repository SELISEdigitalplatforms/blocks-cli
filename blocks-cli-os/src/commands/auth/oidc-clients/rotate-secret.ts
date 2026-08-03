import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authOidcClientsRotateSecret(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const clientId = args[0] || stringFlag(flags, "client-id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/oidc-clients/${clientId}/rotate-secret` }, flags);
    return;
  }

  await confirmMutation(flags, `Rotate the client secret for OIDC client '${clientId}'. The old secret stops working immediately; the new one is shown once.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/oidc-clients/${encodeURIComponent(clientId)}/rotate-secret`, {
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
