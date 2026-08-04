import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authIdpDelete(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/auth/identity-providers/${id}` }, flags);
    return;
  }

  await confirmMutation(flags, `Delete identity provider '${id}'. This also removes its OIDC client and is irreversible.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/auth/identity-providers/${encodeURIComponent(id)}`, {
    impersonatedProjectAuth: true,
    method: "DELETE",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
