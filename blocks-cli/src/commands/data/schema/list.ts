import { integerFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { unwrapSchemaListResponse } from "../../../lib/data-response.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataSchemaList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const pageNo = integerFlag(flags, "page", 1);
  const pageSize = integerFlag(flags, "page-size", 100);
  const result = await blocksRequest<unknown>("/data/v4/schemas", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { PageNo: pageNo, PageSize: pageSize, ProjectKey: projectKey }
  });
  // Throws on a malformed envelope so an unexpected response shape is never
  // mistaken for an empty schema list.
  unwrapSchemaListResponse(result);
  writeOutput(result, flags);
}
