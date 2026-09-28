import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { redactSecrets } from "../../lib/redact.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, secretIdArg, secretValueInput } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** Replaces a secret's value in place (Secrets/rotate); the id, access list and audit trail stay. */
export async function secretsRotate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretId = secretIdArg(args, stringFlag(flags, "secret-id"));
  const value = await secretValueInput(
    {
      envName: stringFlag(flags, "value-env"),
      file: stringFlag(flags, "value-file"),
      inline: stringFlag(flags, "value")
    },
    { required: true }
  );
  const body = { secretId, value };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${OS_SECRETS_API}/rotate`, request: redactSecrets(body, ["value"]) }, flags);
    return;
  }

  await confirmMutation(flags, `Rotate the value of secret '${secretId}' (the old value stops working; the new one is never displayed).`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/rotate`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
