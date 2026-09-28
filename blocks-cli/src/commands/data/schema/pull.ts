import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { toPortableSchema, writeSchemaFile } from "../../../lib/data-files.js";
import { unwrapSchemaListResponse } from "../../../lib/data-response.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

const PAGE_SIZE = 500;

export async function dataSchemaPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const items: Record<string, unknown>[] = [];
  let pageNo = 1;
  let totalCount = Infinity;

  while (items.length < totalCount) {
    const response = await blocksRequest<unknown>("/data/v4/schemas", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { PageNo: pageNo, PageSize: PAGE_SIZE, ProjectKey: projectKey }
    });
    const page = unwrapSchemaListResponse(response);
    totalCount = page.totalCount;
    if (page.items.length === 0) break;
    items.push(...page.items);
    pageNo += 1;
  }

  const files: string[] = [];
  for (const schema of items) {
    files.push(await writeSchemaFile(toPortableSchema(schema)));
  }

  writeOutput({ files, count: files.length }, flags);
}
