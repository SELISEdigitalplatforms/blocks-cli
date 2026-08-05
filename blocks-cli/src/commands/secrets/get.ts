import { integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function secretsGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretKey = args[0] || stringFlag(flags, "secret-key", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Secrets/Gets", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      PageNumber: integerFlag(flags, "page-number", 0),
      PageSize: integerFlag(flags, "page-size", 10),
      secretKey
    }
  });
  writeOutput(result, flags);
}
