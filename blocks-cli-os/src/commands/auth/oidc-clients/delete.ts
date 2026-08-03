import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authOidcClientsDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const clientId = args[0] || stringFlag(flags, "client-id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/oidc-clients/${clientId}` }, flags);
    return;
  }

  await confirmMutation(flags, `Delete OIDC client '${clientId}'. This revokes all issued tokens and is irreversible.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/oidc-clients/${encodeURIComponent(clientId)}`, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
