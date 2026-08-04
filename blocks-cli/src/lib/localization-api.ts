import { blocksRequest } from "./api.js";
import { requestContext } from "./request-context.js";

const LOCALIZATION_API = "/localization/v4";

type Flags = Record<string, string | boolean>;

type ModuleRecord = Record<string, unknown> & {
  itemId?: string;
  moduleName?: string;
  name?: string;
};

type ApiResponse = {
  errorMessage?: string;
  success?: boolean;
  validationErrors?: Array<{ errorMessage?: string; propertyName?: string }>;
};

export type LocalizationSaveKey = {
  context?: string;
  keyName: string;
  moduleId: string;
  resources: Array<{
    characterLength: number;
    culture: string;
    value: string;
  }>;
  routes?: string[];
  shouldPublish: boolean;
};

export async function resolveLocalizationModuleId(
  moduleName: string,
  flags: Flags,
  projectTenantId: string,
  options: { createIfMissing: boolean }
): Promise<string> {
  const existing = await findLocalizationModule(moduleName, flags, projectTenantId);
  if (existing?.itemId) return existing.itemId;
  if (!options.createIfMissing) throw new Error(`Localization module '${moduleName}' was not found.`);

  await assertApiSuccess(await blocksRequest<ApiResponse>(`${LOCALIZATION_API}/Module/Save`, {
    body: { moduleName },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  }));

  const created = await findLocalizationModule(moduleName, flags, projectTenantId);
  if (!created?.itemId) throw new Error(`Localization module '${moduleName}' was saved but could not be resolved.`);
  return created.itemId;
}

export async function saveLocalizationKeys(keys: LocalizationSaveKey[], flags: Flags, projectTenantId: string): Promise<ApiResponse> {
  return assertApiSuccess(await blocksRequest<ApiResponse>(`${LOCALIZATION_API}/Key/SaveKeys`, {
    body: keys,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  }));
}

export async function getCloudLocalizationDictionary(
  moduleName: string,
  language: string,
  flags: Flags,
  projectTenantId: string
): Promise<Record<string, string>> {
  const result = await blocksRequest<unknown>(`${LOCALIZATION_API}/Key/GetCloudUilmFile`, {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: { Language: language, ModuleName: moduleName }
  });

  return normalizeDictionary(result);
}

async function findLocalizationModule(moduleName: string, flags: Flags, projectTenantId: string): Promise<ModuleRecord | undefined> {
  const result = await blocksRequest<unknown>(`${LOCALIZATION_API}/Module/Gets`, {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });

  const modules = normalizeModules(result);
  return modules.find((item) => {
    const name = String(item.moduleName ?? item.name ?? "").toLowerCase();
    return name === moduleName.toLowerCase();
  });
}

function normalizeModules(result: unknown): ModuleRecord[] {
  if (Array.isArray(result)) return result as ModuleRecord[];
  if (!result || typeof result !== "object") return [];

  const record = result as Record<string, unknown>;
  for (const key of ["modules", "items", "data"]) {
    const value = record[key];
    if (Array.isArray(value)) return value as ModuleRecord[];
    if (value && typeof value === "object") {
      const nested = normalizeModules(value);
      if (nested.length) return nested;
    }
  }

  return [];
}

function normalizeDictionary(result: unknown): Record<string, string> {
  const value = result && typeof result === "object" && "data" in result ? (result as Record<string, unknown>).data : result;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const dictionary: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (typeof entry === "string") dictionary[key] = entry;
  }
  return dictionary;
}

function assertApiSuccess<T extends ApiResponse>(response: T): T {
  if (response?.success === false) {
    const validation = response.validationErrors?.map((item) => item.errorMessage ?? item.propertyName).filter(Boolean).join("; ");
    throw new Error(response.errorMessage ?? validation ?? "Localization API request failed.");
  }
  return response;
}
