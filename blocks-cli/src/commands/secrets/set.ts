import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact, jsonBodyFlag, listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { redactSecrets } from "../../lib/redact.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, SECRET_TYPE, secretValueInput } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Creates one secret (Secrets/set -> {secretId}). Names are not unique server-side, so
 * every call creates a new document; change an existing secret's value with
 * 'secrets rotate' and its metadata with 'secrets update'. The type is always the CLI's
 * fixed one -- a type in --body/--file is overridden, never forwarded.
 */
export async function secretsSet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const userIds = listFlag(flags, "user-ids");
  const roles = listFlag(flags, "roles");
  const value = await secretValueInput({
    envName: stringFlag(flags, "value-env"),
    file: stringFlag(flags, "value-file"),
    inline: stringFlag(flags, "value")
  });

  const body: Record<string, unknown> = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      access: userIds || roles ? { roles: roles ?? [], userIds: userIds ?? [] } : undefined,
      description: stringFlag(flags, "description") || undefined,
      name: args[0] || stringFlag(flags, "name") || undefined,
      organizationId: stringFlag(flags, "organization-id") || undefined,
      value
    }),
    type: SECRET_TYPE
  };

  if (!body.name) {
    throw new CliActionableError("A secret name is required.", "secret_name_required", "Pass the name as the first argument or --name <name>.");
  }
  if (!body.value) {
    throw new CliActionableError(
      "A secret value is required.",
      "secret_value_required",
      "Pass --value-file <path> or --value-env <NAME> (preferred: keeps the value out of shell history), or --value <text>."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${OS_SECRETS_API}/set`, request: redactSecrets(body, ["value"]) }, flags);
    return;
  }

  await confirmMutation(flags, `Create secret '${body.name as string}'; the value is never displayed.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/set`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}
