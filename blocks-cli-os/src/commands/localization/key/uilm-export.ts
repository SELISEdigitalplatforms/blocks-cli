import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyUilmExport(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = compact({
    appIds: listFlag(flags, "app-ids"),
    callerTenantId: stringFlag(flags, "caller-tenant-id") || undefined,
    endDate: stringFlag(flags, "end-date") || undefined,
    languages: listFlag(flags, "languages"),
    messageCoRelationId: stringFlag(flags, "message-co-relation-id") || undefined,
    outputType: integerFlag(flags, "output-type", 0),
    referenceFileId: stringFlag(flags, "reference-file-id") || undefined,
    startDate: stringFlag(flags, "start-date") || undefined
  });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/UilmExport", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Export UILM file.");
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/UilmExport", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
