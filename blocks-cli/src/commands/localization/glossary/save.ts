import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationGlossarySave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      additionalNote: stringFlag(flags, "additional-note") || undefined,
      context: stringFlag(flags, "context") || undefined,
      isGlobal: booleanFlag(flags, "is-global") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      language: stringFlag(flags, "language") || undefined,
      moduleIds: listFlag(flags, "module-ids"),
      name: stringFlag(flags, "name") || undefined,
      type: stringFlag(flags, "type") || undefined
    })
  };

  if (!body.name) throw new Error("Provide --name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Glossary/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save glossary term '${body.name}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Glossary/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
