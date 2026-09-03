import { stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { CliActionableError } from "../../lib/errors.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, isNotFoundError, secretIdArg } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** One secret's metadata (Secrets/get): name, type, status, access, rotation, canReadValue -- never the value. */
export async function secretsGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretId = secretIdArg(args, stringFlag(flags, "secret-id"));
  const projectKey = await selectedProject(flags);

  try {
    const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/get`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      query: { secretId },
      ...requestContext(flags)
    });
    writeOutput(result, flags);
  } catch (error) {
    if (!isNotFoundError(error)) throw error;
    throw new CliActionableError(
      `Secret '${secretId}' was not found in this project.`,
      "secret_not_found",
      "Run 'blocks secrets list --include-deleted --json' and use a listed secretId."
    );
  }
}
