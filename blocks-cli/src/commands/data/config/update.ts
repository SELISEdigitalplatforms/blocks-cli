import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";
import { withGatewayReload } from "../../../lib/data-gateway.js";

export async function dataConfigUpdate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  // PUT /configurations rebinds the whole data source. ConnectionString and
  // DatabaseName are validated as required, so omitting them fails loudly -- but
  // IsCollectionNameEditable is a non-nullable bool and CollectionNamePattern defaults
  // to "", so a connection-string-only update silently reset both. Read the current
  // configuration (the GET returns the connection string decoded, under
  // `dbConnectionString`) and merge the flags over it.
  const current = carryCurrent(
    await blocksRequest<unknown>("/data/v4/configurations", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }),
    ["itemId", "dbConnectionString", "databaseName", "isCollectionNameEditable", "collectionNamePattern"],
    { dbConnectionString: "connectionString" }
  );

  const body = {
    ...current,
    ...(await jsonBodyFlag(flags)),
    ...compact({
      collectionNamePattern: stringFlag(flags, "collection-name-pattern") || undefined,
      connectionString: stringFlag(flags, "connection-string") || undefined,
      databaseName: stringFlag(flags, "database-name") || undefined,
      isCollectionNameEditable: optionalBooleanFlag(flags, "collection-name-editable"),
      itemId: stringFlag(flags, "item-id") || undefined
    })
  };

  if (!body.itemId) throw new Error("Provide --item-id (the existing configuration's id).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/configurations", request: redactSecrets(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Update data source configuration '${body.itemId}'.`);
  const result = await blocksRequest<unknown>("/data/v4/configurations", {
    body: { ...body, projectKey },
    impersonatedProjectAuth: true,
    method: "PUT",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(await withGatewayReload(flags, projectKey, result), flags);
}
