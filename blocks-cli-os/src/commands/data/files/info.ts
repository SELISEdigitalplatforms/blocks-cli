import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesInfo(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  const filter = compact({
    name: stringFlag(flags, "name") || undefined,
    tenantId: stringFlag(flags, "tenant-id") || undefined
  });

  const body = {
    filter: Object.keys(filter).length ? filter : undefined,
    page: integerFlag(flags, "page", 1),
    pageSize: integerFlag(flags, "page-size", 20),
    sort: {
      isDescending: booleanFlag(flags, "sort-desc"),
      property: stringFlag(flags, "sort-by") || undefined
    }
  };

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/GetFilesInfo", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
