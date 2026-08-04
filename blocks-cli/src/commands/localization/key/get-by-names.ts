import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetByNames(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const keyNames = listFlag(flags, "key-names") ?? args;
  if (!keyNames.length) throw new Error("Provide key names as arguments or --key-names a,b.");

  const projectTenantId = await selectedProject(flags);
  const body = {
    keyNames,
    ...compact({ moduleId: stringFlag(flags, "module-id") || undefined })
  };

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetsByKeyNames", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
