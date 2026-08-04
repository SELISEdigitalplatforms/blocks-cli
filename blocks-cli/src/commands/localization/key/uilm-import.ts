import { randomUUID } from "node:crypto";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyUilmImport(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = args[0] || stringFlag(flags, "file-id", { required: true });
  const messageCoRelationId = stringFlag(flags, "message-co-relation-id", { defaultValue: randomUUID() });
  const body = { fileId, messageCoRelationId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/UilmImport", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Import UILM file '${fileId}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/UilmImport", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
