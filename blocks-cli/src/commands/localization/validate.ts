import { stringFlag } from "../../lib/args.js";
import { defaultLocalizationPath, readLocalizationDictionary, validateLocalizationDictionary } from "../../lib/localization-files.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";

export async function localizationValidate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const moduleName = stringFlag(flags, "module", { required: true });
  const language = stringFlag(flags, "language", { required: true });
  const file = stringFlag(flags, "file", { defaultValue: await defaultLocalizationPath(moduleName, language) });
  const dictionary = await readLocalizationDictionary(file);
  const errors = validateLocalizationDictionary(dictionary);

  if (errors.length) throw new Error(`Localization validation failed:\n${errors.join("\n")}`);

  writeOutput({ file, keys: Object.keys(dictionary).length, language, module: moduleName, valid: true }, flags);
}
