import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { writeSchemaFile } from "../../../lib/data-files.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type SchemaListResponse = { data?: { items?: Record<string, unknown>[] } };

export async function dataSchemaPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<SchemaListResponse>("/data/v4/schemas", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { PageNo: 1, PageSize: 500, ProjectKey: projectKey }
  });

  const files: string[] = [];
  for (const schema of result.data?.items ?? []) {
    files.push(await writeSchemaFile(schema));
  }

  writeOutput({ files, count: files.length }, flags);
}
