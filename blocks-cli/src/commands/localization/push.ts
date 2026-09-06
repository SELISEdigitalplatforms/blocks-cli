import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import {
  findLocalizationModuleId,
  getLocalizationKeysByNames,
  resolveLocalizationModuleId,
  saveLocalizationKeys,
  upsertResource,
  type LocalizationSaveKey
} from "../../lib/localization-api.js";
import { defaultLocalizationPath, readLocalizationDictionary, validateLocalizationDictionary } from "../../lib/localization-files.js";
import { carryCurrent } from "../../lib/merge-current.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

type Flags = Record<string, string | boolean>;
type Dictionary = Record<string, string>;

export async function localizationPush(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const file = stringFlag(flags, "file", { defaultValue: await defaultLocalizationPath(moduleName, language) });
  const dictionary = await readLocalizationDictionary(file);
  const errors = validateLocalizationDictionary(dictionary, moduleName);
  if (errors.length) throw new Error(`Localization validation failed:\n${errors.join("\n")}`);

  if (booleanFlag(flags, "dry-run")) {
    // Resolve read-only: a dry run must not be the call that creates the module.
    const moduleId = await findLocalizationModuleId(moduleName, flags, projectTenantId);
    const merged = await mergedKeys(dictionary, moduleId ?? "", language, flags, projectTenantId, { lookup: Boolean(moduleId) });
    writeOutput(
      { dryRun: true, file, language, module: moduleName, moduleId, project: projectTenantId, request: merged.keys, ...counts(merged) },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    `Push ${Object.keys(dictionary).length} localization key(s) to module '${moduleName}' for '${language}' in project '${projectTenantId}'.`
  );
  const moduleId = await resolveLocalizationModuleId(moduleName, flags, projectTenantId, { createIfMissing: true });
  const merged = await mergedKeys(dictionary, moduleId, language, flags, projectTenantId, { lookup: true });
  const response = await saveLocalizationKeys(merged.keys, flags, projectTenantId);

  writeOutput({ file, language, module: moduleName, moduleId, project: projectTenantId, result: response, ...counts(merged) }, flags);
}

/**
 * `Key/SaveKeys` assigns the request's Resources over the stored ones instead of merging
 * them, so a push that sent only the pushed culture wiped every other translation --
 * pushing en-US then de-DE left each key holding de-DE alone. Read the module's keys back
 * first and upsert one culture into each, carrying the rest of the stored record (routes,
 * glossary ids, context) so those are not defaulted away either.
 */
async function mergedKeys(
  dictionary: Dictionary,
  moduleId: string,
  language: string,
  flags: Flags,
  projectTenantId: string,
  options: { lookup: boolean }
): Promise<{ existing: Set<string>; keys: LocalizationSaveKey[] }> {
  const keyNames = Object.keys(dictionary);
  const existing = options.lookup
    ? await getLocalizationKeysByNames(keyNames, moduleId, flags, projectTenantId)
    : new Map<string, Record<string, unknown>>();

  const route = stringFlag(flags, "route");
  const context = stringFlag(flags, "context");

  const keys = keyNames.map((keyName) => {
    const current = carryCurrent(existing.get(keyName), [
      "itemId",
      "resources",
      "routes",
      "glossaryIds",
      "context",
      "isPartiallyTranslated"
    ]);

    return {
      ...current,
      context: context || (current.context as string | undefined),
      keyName,
      moduleId,
      resources: upsertResource(current.resources, language, dictionary[keyName]),
      routes: route ? [route] : (current.routes as string[] | undefined),
      shouldPublish: true
    };
  });

  return { existing: new Set(existing.keys()), keys };
}

/** How many of the pushed keys the module already stored, so the caller can see what a push replaces. */
function counts(merged: { existing: Set<string>; keys: LocalizationSaveKey[] }): { created: number; keys: number; updated: number } {
  const updated = merged.keys.filter((key) => merged.existing.has(key.keyName)).length;
  return { created: merged.keys.length - updated, keys: merged.keys.length, updated };
}
