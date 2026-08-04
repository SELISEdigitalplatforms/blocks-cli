import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authIdpStatus(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  if (!("active" in flags)) throw new Error("Provide --active or --active=false.");
  const isActive = booleanFlag(flags, "active");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/auth/identity-providers/${id}/status`, request: { isActive } }, flags);
    return;
  }

  await confirmMutation(flags, `${isActive ? "Enable" : "Disable"} identity provider '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/auth/identity-providers/${encodeURIComponent(id)}/status`, {
    body: { isActive },
    impersonatedProjectAuth: true,
    method: "PATCH",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
