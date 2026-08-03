import { booleanFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { resolveLocalizationModuleId, saveLocalizationKeys } from "../../lib/localization-api.js";
import { defaultLocalizationPath, readLocalizationDictionary, validateLocalizationDictionary } from "../../lib/localization-files.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function localizationPush(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const file = stringFlag(flags, "file", { defaultValue: await defaultLocalizationPath(moduleName, language) });
  const route = stringFlag(flags, "route");
  const context = stringFlag(flags, "context");
  const dictionary = await readLocalizationDictionary(file);
  const errors = validateLocalizationDictionary(dictionary);
  if (errors.length) throw new Error(`Localization validation failed:\n${errors.join("\n")}`);

  const keys = Object.entries(dictionary).map(([keyName, value]) => ({
    context: context || undefined,
    keyName,
    moduleId: "",
    resources: [{ characterLength: value.length, culture: language, value }],
    routes: route ? [route] : undefined,
    shouldPublish: true
  }));

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, file, keys: keys.length, language, module: moduleName, project: projectTenantId }, flags);
    return;
  }

  await confirmMutation(flags, `Push ${keys.length} localization key(s) to module '${moduleName}' for '${language}' in project '${projectTenantId}'.`);
  const moduleId = await resolveLocalizationModuleId(moduleName, flags, projectTenantId, { createIfMissing: true });
  const response = await saveLocalizationKeys(keys.map((key) => ({ ...key, moduleId })), flags, projectTenantId);

  writeOutput({ file, keys: keys.length, language, module: moduleName, moduleId, project: projectTenantId, result: response }, flags);
}
