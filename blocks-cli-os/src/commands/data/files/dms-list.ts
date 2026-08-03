import { integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function dataFilesDmsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    parentId: stringFlag(flags, "parent-id"),
    take: integerFlag(flags, "take", 20),
    ...compact({
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      moduleName: stringFlag(flags, "module-name") || undefined,
      searchKey: stringFlag(flags, "search") || undefined,
      skip: integerFlag(flags, "skip", 0) || undefined
    })
  };

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/GetDmsFileAndFolder", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
