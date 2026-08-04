import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetUilmFile(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetUilmFile", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: { Language: language, ModuleName: moduleName }
  });
  writeOutput(result, flags);
}
