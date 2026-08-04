import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeySave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const value = stringFlag(flags, "value") || undefined;
  const culture = stringFlag(flags, "culture") || undefined;
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      context: stringFlag(flags, "context") || undefined,
      glossaryIds: listFlag(flags, "glossary-ids"),
      isNewKey: booleanFlag(flags, "is-new-key") || undefined,
      isPartiallyTranslated: booleanFlag(flags, "is-partially-translated") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      keyName: stringFlag(flags, "key-name") || undefined,
      moduleId: stringFlag(flags, "module-id") || undefined,
      resources: value ? [{ characterLength: value.length, culture, value }] : undefined,
      routes: listFlag(flags, "routes"),
      shouldPublish: booleanFlag(flags, "should-publish") || undefined
    })
  };

  if (!body.keyName) throw new Error("Provide --key-name (or set it in --body/--file).");
  if (!body.moduleId) throw new Error("Provide --module-id (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save localization key '${body.keyName}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
