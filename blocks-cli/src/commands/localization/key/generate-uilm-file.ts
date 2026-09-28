import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGenerateUilmFile(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const moduleId = stringFlag(flags, "module-id") || undefined;
  if (!moduleId) throw new Error("Provide --module-id.");

  // GenerateUilmRequest.Guid is non-nullable, so omitting it fails model binding with
  // "Guid: The Guid field is required." even though the generator never reads it -- it is
  // only carried onto the queued GenerateUilmFilesEvent (SaveKeys passes the key's itemId
  // there). Default it to the module id so --module-id alone works, here and in the
  // translate-and-export flow that calls this command without a --guid.
  const body = compact({
    guid: stringFlag(flags, "guid") || moduleId,
    moduleId
  });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/GenerateUilmFile", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Generate UILM file for module '${body.moduleId}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/GenerateUilmFile", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
