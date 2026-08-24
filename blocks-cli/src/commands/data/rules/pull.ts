import { blocksRequest } from "../../../lib/api.js";
import { toPortablePolicy, writeRulesFile } from "../../../lib/data-files.js";
import { unwrapDataArray, unwrapSchemaListResponse } from "../../../lib/data-response.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataRulesPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const schemasResponse = await blocksRequest<unknown>("/data/v4/schemas", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { PageNo: 1, PageSize: 500, ProjectKey: projectKey }
  });
  const { items: schemas } = unwrapSchemaListResponse(schemasResponse);

  const policies: unknown[] = [];
  for (const schema of schemas) {
    const schemaName = schema.schemaName;
    if (typeof schemaName !== "string" || !schemaName) continue;
    const response = await blocksRequest<unknown>("/data/v4/data-access/policy/get", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { schemaName }
    });
    for (const item of unwrapDataArray(response, "data access policy")) {
      policies.push(toPortablePolicy(item, schemaName));
    }
  }

  const file = await writeRulesFile({ policies });
  writeOutput({ count: policies.length, file }, flags);
}
