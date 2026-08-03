import { blocksRequest } from "../../../lib/api.js";
import { writeRulesFile } from "../../../lib/data-files.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type SchemaListResponse = { data?: { items?: Array<{ schemaName?: string }> } };

export async function dataRulesPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const schemas = await blocksRequest<SchemaListResponse>("/data/v4/schemas", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { PageNo: 1, PageSize: 500, ProjectKey: projectKey }
  });

  const policies: unknown[] = [];
  for (const schema of schemas.data?.items ?? []) {
    if (!schema.schemaName) continue;
    policies.push(await blocksRequest<unknown>("/data/v4/data-access/policy/get", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { schemaName: schema.schemaName }
    }));
  }

  const file = await writeRulesFile({ policies });
  writeOutput({ count: policies.length, file }, flags);
}
