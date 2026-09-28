import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../../lib/merge-current.js";
import { redactSecrets } from "../../../lib/redact.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function authClientCredentialsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessTokenValidForNumberMinutes: optionalIntegerFlag(flags, "access-token-valid-minutes"),
      isActive: optionalBooleanFlag(flags, "active"),
      itemId: stringFlag(flags, "item-id") || undefined,
      name: stringFlag(flags, "name") || undefined,
      permissions: listFlag(flags, "permissions"),
      roles: listFlag(flags, "roles")
    })
  };

  if (!overrides.name && !overrides.itemId) throw new Error("Provide --name (create) or --item-id (update), or set them in --body/--file.");

  const itemId = typeof overrides.itemId === "string" ? overrides.itemId : undefined;

  // Saving with an itemId replaces the credential: the service copies Name, IsActive,
  // AccessTokenValidForNumberMinutes, Roles and Permissions from the request as-is, and
  // the request DTO defaults IsActive to true, the lifetime to 5 minutes and both lists
  // to empty. A roles-only save therefore re-activated a disabled credential, reset its
  // token lifetime and dropped every permission. There is no GET-by-id, so the current
  // record comes from the list. ClientSecret is deliberately not carried -- the save
  // DTO has no such field, and the secret must never be echoed back at the API. A new
  // credential has nothing to read, so its dry-run stays offline.
  const current = itemId
    ? carryCurrent(
        findClientCredential(
          await blocksRequest<unknown>("/iam/v4/auth/client-credentials", {
            impersonatedProjectAuth: true,
            ...requestContext(flags),
            projectTenantId: await selectedProject(flags)
          }),
          itemId
        ),
        ["name", "isActive", "accessTokenValidForNumberMinutes", "roles", "permissions"]
      )
    : {};

  const body = { ...current, ...overrides };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/auth/client-credentials", request: redactSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save client credential '${body.name ?? body.itemId}'. The response's clientSecret is shown once.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/auth/client-credentials", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function findClientCredential(list: unknown, itemId: string): Record<string, unknown> {
  const found = findInList(list, (item) => item.itemId === itemId);
  if (!found) throw new Error(`Client credential '${itemId}' was not found. Run 'blocks auth client-credentials list --json' for the current ids.`);
  return found;
}
