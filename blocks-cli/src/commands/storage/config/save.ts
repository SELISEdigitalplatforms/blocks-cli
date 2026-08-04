import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function storageConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessKey: stringFlag(flags, "access-key") || undefined,
      cloudStorageRegionEndPoint: stringFlag(flags, "region-endpoint") || undefined,
      connectionString: stringFlag(flags, "connection-string") || undefined,
      host: stringFlag(flags, "host") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      name: stringFlag(flags, "name") || undefined,
      password: stringFlag(flags, "password") || undefined,
      port: stringFlag(flags, "port") || undefined,
      remoteBasePath: stringFlag(flags, "remote-base-path") || undefined,
      secretKey: stringFlag(flags, "secret-key") || undefined,
      storageStrategy: stringFlag(flags, "strategy") || undefined,
      updateRequest: booleanFlag(flags, "update") || undefined,
      userName: stringFlag(flags, "username") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Storage/Save", request: redactSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save storage configuration '${body.name ?? body.itemId ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Storage/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function redactSecrets(body: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...body };
  for (const key of ["accessKey", "connectionString", "password", "secretKey"]) {
    if (redacted[key]) redacted[key] = "***";
  }
  return redacted;
}
