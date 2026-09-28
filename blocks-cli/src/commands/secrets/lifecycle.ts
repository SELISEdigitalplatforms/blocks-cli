import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, secretIdArg } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/** Lock: value reads and rotations are refused (409 invalid_state) until 'secrets unlock'. */
export async function secretsLock(argv: string[]): Promise<void> {
  await lifecycle(argv, "lock", (id) => `Lock secret '${id}' (value reads and rotations are refused until it is unlocked).`);
}

export async function secretsUnlock(argv: string[]): Promise<void> {
  await lifecycle(argv, "unlock", (id) => `Unlock secret '${id}'.`);
}

/** Soft delete: metadata is marked deleted and the vault value retained, so 'secrets restore' undoes it. */
export async function secretsDelete(argv: string[]): Promise<void> {
  await lifecycle(argv, "delete", (id) => `Soft-delete secret '${id}' (recoverable with 'blocks secrets restore ${id}').`);
}

export async function secretsRestore(argv: string[]): Promise<void> {
  await lifecycle(argv, "restore", (id) => `Restore the soft-deleted secret '${id}'.`);
}

/**
 * The four status transitions of SecretsController share one shape: lock/unlock/restore
 * POST {secretId}, delete is DELETE ?secretId. Each is idempotent-looking but the server
 * enforces the state machine (e.g. rotate on a locked secret, restore on a live one).
 */
async function lifecycle(argv: string[], action: "delete" | "lock" | "restore" | "unlock", describe: (id: string) => string): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const secretId = secretIdArg(args, stringFlag(flags, "secret-id"));
  const isDelete = action === "delete";

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        action,
        dryRun: true,
        endpoint: `${OS_SECRETS_API}/${action}`,
        method: isDelete ? "DELETE" : "POST",
        ...(isDelete ? { query: { secretId }, restorable: true } : { request: { secretId } })
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, describe(secretId));
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/${action}`, {
    ...(isDelete ? { method: "DELETE", query: { secretId } } : { body: { secretId } }),
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput({ action, result, secretId, ...(isDelete ? { restorable: true } : {}) }, flags);
}
