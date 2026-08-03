import { stringFlag } from "../../lib/args.js";
import { getCloudLocalizationDictionary } from "../../lib/localization-api.js";
import { defaultLocalizationPath, writeLocalizationDictionary } from "../../lib/localization-files.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function localizationPull(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const out = stringFlag(flags, "out", { defaultValue: await defaultLocalizationPath(moduleName, language) });
  const dictionary = await getCloudLocalizationDictionary(moduleName, language, flags, projectTenantId);

  await writeLocalizationDictionary(out, dictionary);

  writeOutput({ file: out, keys: Object.keys(dictionary).length, language, module: moduleName, project: projectTenantId }, flags);
}
