import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationModuleTagGlossary(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const moduleId = args[0] || stringFlag(flags, "module-id", { required: true });
  const glossaryIds = listFlag(flags, "glossary-ids");
  if (!glossaryIds?.length) throw new Error("Provide --glossary-ids a,b.");

  const body = { glossaryIds, moduleId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Module/TagGlossary", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Tag ${glossaryIds.length} glossary term(s) to module '${moduleId}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Module/TagGlossary", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
