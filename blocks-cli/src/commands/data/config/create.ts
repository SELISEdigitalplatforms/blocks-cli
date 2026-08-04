import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataConfigCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      connectionString: stringFlag(flags, "connection-string") || undefined,
      databaseName: stringFlag(flags, "database-name") || undefined
    })
  };

  if (!body.connectionString) throw new Error("Provide --connection-string (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/configurations", request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, "Create a new data source configuration for this project. This points the Data Gateway at an external database.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/configurations", {
    body: { ...body, projectKey },
    impersonatedProjectAuth: true,
    method: "POST",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function redactSecret(body: Record<string, unknown>): Record<string, unknown> {
  if (!body.connectionString) return body;
  return { ...body, connectionString: "***" };
}
