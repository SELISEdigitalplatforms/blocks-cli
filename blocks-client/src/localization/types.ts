export type BlocksLocalizationLanguage = Record<string, unknown> & {
  itemId?: string;
  code?: string;
  culture?: string;
  displayName?: string;
  isDefault?: boolean;
  languageCode?: string;
  languageName?: string;
  name?: string;
};

export type BlocksLocalizationModule = Record<string, unknown> & {
  itemId?: string;
  moduleName?: string;
  name?: string;
};

export type BlocksLocalizationDictionary = Record<string, string>;

export type BlocksLocalizationTranslationOptions = {
  language: string;
  moduleName: string;
};

export type BlocksLocalizationKeyResource = {
  characterLength?: number;
  culture?: string;
  value?: string;
};

export type BlocksLocalizationKey = Record<string, unknown> & {
  context?: string;
  isNewKey?: boolean;
  isPartiallyTranslated?: boolean;
  itemId?: string;
  keyName?: string;
  moduleId?: string;
  resources?: BlocksLocalizationKeyResource[];
  routes?: string[];
};

export type BlocksLocalizationKeysByNamesRequest = {
  keyNames: string[];
  moduleId?: string;
};

export type BlocksLocalizationKeysByNamesResponse = Record<string, unknown> & {
  keys?: BlocksLocalizationKey[];
  errorMessage?: string;
};
