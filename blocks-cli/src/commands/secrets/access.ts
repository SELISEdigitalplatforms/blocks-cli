import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { listFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, SecretResult, secretIdArg, uniqueStrings } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Sets who may read a secret's value (Secrets/access: {secretId, access: {userIds, roles}}).
 * The server REPLACES the list, so by default this does too; --merge reads the current
 * list first and adds to it, --clear sends empty lists (no per-secret restriction).
 */
export async function secretsAccess(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretId = secretIdArg(args, stringFlag(flags, "secret-id"));
  const userIds = uniqueStrings(listFlag(flags, "user-ids") ?? []);
  const roles = uniqueStrings(listFlag(flags, "roles") ?? []);
  const merge = booleanFlag(flags, "merge");
  const clear = booleanFlag(flags, "clear");

  if (clear && (merge || userIds.length > 0 || roles.length > 0)) {
    throw new CliActionableError("--clear cannot be combined with --merge, --user-ids or --roles.", "secret_access_conflict", "Pass --clear alone to remove every restriction.");
  }
  if (!clear && userIds.length === 0 && roles.length === 0) {
    throw new CliActionableError(
      "Nothing to set.",
      "secret_access_empty",
      "Pass --user-ids a,b and/or --roles a,b (add --merge to keep the current entries), or --clear."
    );
  }

  const projectKey = await selectedProject(flags);
  let access = { roles, userIds };
  let mode: "clear" | "merge" | "replace" = clear ? "clear" : merge ? "merge" : "replace";
  if (merge) {
    const current = await blocksRequest<SecretResult>(`${OS_SECRETS_API}/get`, {
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      query: { secretId },
      ...requestContext(flags)
    });
    access = {
      roles: uniqueStrings([...(current?.access?.roles ?? []), ...roles]),
      userIds: uniqueStrings([...(current?.access?.userIds ?? []), ...userIds])
    };
  }
  if (clear) access = { roles: [], userIds: [] };

  const body = { access, secretId };
  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `${OS_SECRETS_API}/access`, mode, request: body }, flags);
    return;
  }

  await confirmMutation(
    flags,
    clear
      ? `Remove the access restriction of secret '${secretId}'.`
      : `${mode === "merge" ? "Extend" : "Replace"} the access list of secret '${secretId}': ${access.userIds.length} user(s), ${access.roles.length} role(s).`
  );
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/access`, {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput({ access, mode, result, secretId }, flags);
}
