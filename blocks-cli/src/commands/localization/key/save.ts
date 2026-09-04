import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { isRecord } from "../../../lib/data-response.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList, sameName } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeySave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const value = stringFlag(flags, "value") || undefined;
  const culture = stringFlag(flags, "culture") || undefined;
  if (value && !culture) throw new Error("Pass --culture with --value: a translation is stored per culture.");

  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      context: stringFlag(flags, "context") || undefined,
      glossaryIds: listFlag(flags, "glossary-ids"),
      isNewKey: optionalBooleanFlag(flags, "is-new-key"),
      isPartiallyTranslated: optionalBooleanFlag(flags, "is-partially-translated"),
      itemId: stringFlag(flags, "item-id") || undefined,
      keyName: stringFlag(flags, "key-name") || undefined,
      moduleId: stringFlag(flags, "module-id") || undefined,
      routes: listFlag(flags, "routes"),
      shouldPublish: optionalBooleanFlag(flags, "should-publish")
    })
  };

  if (!overrides.keyName) throw new Error("Provide --key-name (or set it in --body/--file).");
  if (!overrides.moduleId) throw new Error("Provide --module-id (or set it in --body/--file).");

  const projectTenantId = await selectedProject(flags);

  // Key/Save upserts by keyName + moduleId and then assigns Resources, Routes,
  // GlossaryIds, Context and IsPartiallyTranslated from the request as-is. Resources is
  // the list of translations, one entry per culture -- so `--value` used to replace
  // every translation with the single culture passed, and a save without `--value`
  // dropped all of them. Read the existing key and merge: `--value` upserts one
  // culture's entry and leaves the others alone, while an explicit `resources` in
  // --body/--file still replaces the whole list.
  const existing = findInList(
    await blocksRequest<unknown>("/localization/v4/Key/GetsByKeyNames", {
      body: { keyNames: [overrides.keyName], moduleId: overrides.moduleId },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId
    }),
    (item) => sameName(item.keyName, overrides.keyName)
  );
  const current = carryCurrent(existing, ["itemId", "resources", "routes", "glossaryIds", "context", "isPartiallyTranslated"]);

  const merged: Record<string, unknown> = { ...current, ...overrides };
  const body = value && culture ? { ...merged, resources: upsertResource(merged.resources, culture, value) } : merged;

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save localization key '${body.keyName}'.`);
  const result = await blocksRequest<unknown>("/localization/v4/Key/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}

/**
 * Replaces the translation for `culture` (matched case-insensitively, keeping the stored
 * spelling) or appends one; every other culture's translation is kept as-is.
 */
function upsertResource(resources: unknown, culture: string, value: string): Record<string, unknown>[] {
  const list = Array.isArray(resources) ? resources.filter(isRecord) : [];
  const index = list.findIndex((item) => sameName(item.culture, culture));
  if (index === -1) return [...list, { characterLength: value.length, culture, value }];
  return list.map((item, position) => (position === index ? { ...item, characterLength: value.length, value } : item));
}
