import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamEmailAvailable(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const email = args[0] || stringFlag(flags, "email", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/iam/email/available", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { Email: email }
  });
  writeOutput(result, flags);
}
