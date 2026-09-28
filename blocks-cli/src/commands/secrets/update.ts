import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, secretIdArg } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** Renames or re-describes a secret (Secrets/update). The value is untouched -- that is 'secrets rotate'. */
export async function secretsUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretId = secretIdArg(args, stringFlag(flags, "secret-id"));
  const body = {
    secretId,
    ...compact({
      description: stringFlag(flags, "description") || undefined,
      name: stringFlag(flags, "name") || undefined
    })
  };
  if (!("name" in body) && !("description" in body)) {
    throw new CliActionableError(
      "Nothing to update.",
      "secret_update_empty",
      "Pass --name <name> and/or --description <text>. To change the value use 'blocks secrets rotate'."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${OS_SECRETS_API}/update`, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update metadata of secret '${secretId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/update`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
