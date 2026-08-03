import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ensureParent, pathsFromWorkspace, readWorkspaceConfig } from "./workspace.js";

export type LocalizationDictionary = Record<string, string>;

export async function defaultLocalizationPath(moduleName: string, language: string): Promise<string> {
  const workspace = await readWorkspaceConfig();
  return join(pathsFromWorkspace(workspace).dictionaries, `${moduleName}.${language}.json`);
}

export async function readLocalizationDictionary(path: string): Promise<LocalizationDictionary> {
  const parsed = JSON.parse(await readFile(path, "utf8")) as unknown;
  const dictionary = flattenDictionary(parsed);
  const invalid = Object.entries(dictionary).filter(([, value]) => typeof value !== "string");
  if (invalid.length) throw new Error(`Localization file '${path}' must contain string values only.`);
  return dictionary as LocalizationDictionary;
}

export async function writeLocalizationDictionary(path: string, dictionary: LocalizationDictionary): Promise<void> {
  await ensureParent(path);
  await writeFile(path, `${JSON.stringify(sortDictionary(dictionary), null, 2)}\n`);
}

export function validateLocalizationDictionary(dictionary: LocalizationDictionary): string[] {
  const errors: string[] = [];
  const keys = Object.keys(dictionary);
  if (!keys.length) errors.push("Localization dictionary is empty.");

  for (const key of keys) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(key)) {
      errors.push(`Invalid key '${key}'. Use letters, numbers, dot, dash, underscore, or colon.`);
    }
    if (!dictionary[key].trim()) errors.push(`Key '${key}' has an empty value.`);
  }

  return errors;
}

function flattenDictionary(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Localization file must be a JSON object.");
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      Object.assign(result, flattenDictionary(entry, fullKey));
    } else {
      result[fullKey] = entry;
    }
  }
  return result;
}

function sortDictionary(dictionary: LocalizationDictionary): LocalizationDictionary {
  return Object.fromEntries(Object.entries(dictionary).sort(([left], [right]) => left.localeCompare(right)));
}
