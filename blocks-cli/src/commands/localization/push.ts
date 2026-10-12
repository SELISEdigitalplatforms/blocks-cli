import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import {
  findLocalizationModuleId,
  generateUilmFile,
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

/**
 * How a push publishes the keys it saves.
 * - `once` (default): save with publishing off, then regenerate the module's UILM file once.
 * - `per-key`: set shouldPublish on every key; the worker regenerates once per key.
 * - `none`: save with publishing off and do not regenerate (run key generate-uilm-file later).
 *
 * `shouldPublish: true` on every key makes the localization worker queue one UILM regeneration
 * per key, so a few-hundred-key push floods the queue and blocks other modules' publishes for
 * tens of minutes. `once` saves every key unpublished then regenerates the touched module a
 * single time -- the same end state in one regeneration instead of hundreds.
 */
type PublishMode = "once" | "per-key" | "none";

function parsePublishMode(flags: Flags): PublishMode {
  const raw = stringFlag(flags, "publish", { defaultValue: "once" });
  if (raw === "once" || raw === "per-key" || raw === "none") return raw;
  throw new Error(`--publish must be one of: once, per-key, none (got '${raw}').`);
}

function publishClause(mode: PublishMode): string {
  switch (mode) {
    case "per-key":
      return " Every key publishes (one UILM regeneration per key).";
    case "none":
      return " Keys are saved without publishing; run key generate-uilm-file to publish.";
    default:
      return " The module's UILM file is regenerated once after saving.";
  }
}

export async function localizationPush(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const file = stringFlag(flags, "file", { defaultValue: await defaultLocalizationPath(moduleName, language) });
  const mode = parsePublishMode(flags);
  const dictionary = await readLocalizationDictionary(file);
  const errors = validateLocalizationDictionary(dictionary, moduleName);
  if (errors.length) throw new Error(`Localization validation failed:\n${errors.join("\n")}`);

  if (booleanFlag(flags, "dry-run")) {
    // Resolve read-only: a dry run must not be the call that creates the module.
    const moduleId = await findLocalizationModuleId(moduleName, flags, projectTenantId);
    const merged = await mergedKeys(dictionary, moduleId ?? "", language, flags, projectTenantId, { lookup: Boolean(moduleId), mode });
    writeOutput(
      {
        dryRun: true,
        file,
        language,
        module: moduleName,
        moduleId,
        project: projectTenantId,
        publish: mode,
        willGenerateUilmFile: mode === "once",
        request: merged.keys,
        ...counts(merged)
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    `Push ${Object.keys(dictionary).length} localization key(s) to module '${moduleName}' for '${language}' in project '${projectTenantId}'.${publishClause(mode)}`
  );
  const moduleId = await resolveLocalizationModuleId(moduleName, flags, projectTenantId, { createIfMissing: true });
  const merged = await mergedKeys(dictionary, moduleId, language, flags, projectTenantId, { lookup: true, mode });
  const response = await saveLocalizationKeys(merged.keys, flags, projectTenantId);

  // In `once` mode the keys were saved unpublished, so regenerate the module's UILM file a
  // single time now instead of letting the worker do it once per key.
  const uilmFile = mode === "once" ? await generateUilmFile(moduleId, flags, projectTenantId) : undefined;

  writeOutput(
    { file, language, module: moduleName, moduleId, project: projectTenantId, publish: mode, result: response, uilmFile, ...counts(merged) },
    flags
  );
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
  options: { lookup: boolean; mode: PublishMode }
): Promise<{ existing: Set<string>; keys: LocalizationSaveKey[] }> {
  const keyNames = Object.keys(dictionary);
  const existing = options.lookup
    ? await getLocalizationKeysByNames(keyNames, moduleId, flags, projectTenantId)
    : new Map<string, Record<string, unknown>>();

  const route = stringFlag(flags, "route");
  const context = stringFlag(flags, "context");
  // Only `per-key` publishes through SaveKeys; `once` and `none` save unpublished so the
  // worker does not queue a regeneration per key.
  const shouldPublish = options.mode === "per-key";

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
      shouldPublish
    };
  });

  return { existing: new Set(existing.keys()), keys };
}

/** How many of the pushed keys the module already stored, so the caller can see what a push replaces. */
function counts(merged: { existing: Set<string>; keys: LocalizationSaveKey[] }): { created: number; keys: number; updated: number } {
  const updated = merged.keys.filter((key) => merged.existing.has(key.keyName)).length;
  return { created: merged.keys.length - updated, keys: merged.keys.length, updated };
}
