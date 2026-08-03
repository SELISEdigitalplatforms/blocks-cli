export type BlocksPagedResult<T> = {
  data?: {
    items?: T[];
    totalCount?: number;
  };
  errors?: unknown;
  httpStatusCode?: number;
  isSuccess?: boolean;
  message?: string | null;
};

export type BlocksDataListOptions = {
  fields?: string[];
  filter?: Record<string, unknown> | string;
  pageNo?: number;
  pageSize?: number;
  /**
   * Legacy convenience alias for the GraphQL DynamicQueryInput.Filter payload.
   * Prefer `filter` for new code.
   */
  query?: Record<string, boolean | number | string | undefined>;
  sort?: Record<string, unknown> | string;
};

export type BlocksDataCollectionOptions = {
  fields?: string[];
};

export type BlocksDataDeleteOptions = {
  hardDelete?: boolean;
};

export type BlocksDataGetOptions = {
  fields?: string[];
};

export type BlocksDataCollection<T = Record<string, unknown>> = {
  create(payload: Partial<T>): Promise<unknown>;
  delete(itemId: string, options?: BlocksDataDeleteOptions): Promise<unknown>;
  get(itemId: string, options?: BlocksDataGetOptions): Promise<unknown>;
  list(options?: BlocksDataListOptions): Promise<unknown>;
  update(itemId: string, payload: Partial<T>): Promise<unknown>;
};

export type BlocksDataSchema = Record<string, unknown> & {
  schemaName?: string;
};

export type BlocksSchemaListOptions = {
  collectionName?: string;
  keyword?: string;
  pageNo?: number;
  pageSize?: number;
  schemaName?: string;
  schemaType?: number;
  sortBy?: string;
  sortDescending?: boolean;
};

export type BlocksSchemaValidationListOptions = BlocksSchemaListOptions & {
  fieldName?: string;
  schemaId?: string;
};

export type BlocksSchemaFieldValidationOptions = {
  fieldName: string;
  schemaId: string;
};

export type BlocksRegexGenerateRequest = Record<string, unknown> & {
  description: string;
};

export type BlocksGraphqlRequest = {
  headers?: HeadersInit;
  operationName?: string;
  query: string;
  variables?: Record<string, unknown>;
};

export type BlocksFileUploadRequest = Record<string, unknown> & {
  accessModifier?: string;
  additionalProperties?: Record<string, string>;
  configurationName?: string;
  contentType?: string;
  fileName?: string;
  itemId?: string;
  metaData?: string;
  moduleName?: number | string;
  name?: string;
  parentDirectoryId?: string;
  tags?: string;
};

export type BlocksFileListRequest = Record<string, unknown> & {
  configurationName?: string;
  fileIds?: string[];
};

export type BlocksFileInfoListRequest = Record<string, unknown> & {
  filter?: Record<string, unknown>;
  page?: number;
  pageNo?: number;
  pageSize?: number;
  sort?: {
    isDescending?: boolean;
    property?: string;
  };
};

export type BlocksFileGetOptions = {
  configurationName?: string;
  version?: number;
};

export type BlocksFileDeleteRequest = Record<string, unknown> & {
  configurationName?: string;
  eventQueueName?: string;
  fileId: string;
};

export type BlocksFolderDeleteRequest = Record<string, unknown> & {
  configurationName?: string;
  folderId: string;
};

export type BlocksFileUpdateAdditionalInfoRequest = Record<string, unknown> & {
  additionalProperties?: Record<string, string>;
  itemId: string;
};

export type BlocksLocalStorageUploadRequest = Record<string, unknown> & {
  accessModifier?: string;
  additionalProperties?: Record<string, string>;
  configurationName?: string;
  file: Blob;
  itemId?: string;
  metaData?: string;
  name: string;
  parentDirectoryId?: string;
  tags?: string | string[];
};

export type BlocksUploadToUrlRequest = {
  body: Blob | ArrayBuffer | ArrayBufferView | ReadableStream;
  contentType?: string;
  headers?: HeadersInit;
  url: string;
};

export type BlocksDmsListRequest = Record<string, unknown> & {
  configurationName?: string;
  moduleName?: string;
  parentId?: string;
  searchKey?: string;
  skip?: number;
  take?: number;
};

export type BlocksDmsMetaDataValue = {
  type: string;
  value: string;
};

export type BlocksDmsUploadItem = Record<string, unknown> & {
  artifactName?: string;
  configurationName?: string;
  description?: string;
  fileStorageId: string;
  metaData?: Record<string, BlocksDmsMetaDataValue>;
  organizationId?: string;
  parentId?: string;
  tags?: string[];
};

export type BlocksDmsUploadRequest = Record<string, unknown> & {
  upload: BlocksDmsUploadItem[];
};

export type BlocksDmsCreateFolderRequest = Record<string, unknown> & {
  artifactName: string;
  configurationName?: string;
  description?: string;
  fileStorageId?: string;
  metaData?: Record<string, BlocksDmsMetaDataValue>;
  organizationId?: string;
  parentId?: string;
  tags?: string[];
};
