import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationGlossarySave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      additionalNote: stringFlag(flags, "additional-note") || undefined,
      context: stringFlag(flags, "context") || undefined,
      isGlobal: optionalBooleanFlag(flags, "is-global"),
      itemId: stringFlag(flags, "item-id") || undefined,
      language: stringFlag(flags, "language") || undefined,
      moduleIds: listFlag(flags, "module-ids"),
      name: stringFlag(flags, "name") || undefined,
      type: stringFlag(flags, "type") || undefined
    })
  };

  const projectTenantId = await selectedProject(flags);
  const itemId = typeof overrides.itemId === "string" ? overrides.itemId : undefined;

  // Glossary/Save with an itemId rebuilds the stored term from the request: only
  // ItemId and CreateDate are kept from the existing document, and Language, Type,
  // Context, AdditionalNote, IsGlobal and ModuleIds are assigned exactly as sent (null
  // or false when omitted). Read the term first when updating and merge; a new term
  // has nothing to carry.
  const current = itemId
    ? carryCurrent(
        await blocksRequest<unknown>("/localization/v4/Glossary/Get", {
          impersonatedProjectAuth: true,
          ...requestContext(flags),
          projectTenantId,
          query: { itemId }
        }),
        ["name", "language", "type", "context", "additionalNote", "isGlobal", "moduleIds"]
      )
    : {};

  const body = { ...current, ...overrides };
  if (!body.name) throw new Error("Provide --name (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Glossary/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save glossary term '${body.name}'.`);
  const result = await blocksRequest<unknown>("/localization/v4/Glossary/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
