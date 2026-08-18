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
  permanent: boolean;
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

export type BlocksStorageObjectType = "directory" | "file";
export type BlocksStorageResourceType = "Directory" | "File";
export type BlocksStoragePrincipalType = "User" | "Role" | "Everyone" | "Organization";
export type BlocksStoragePermission = "View" | "Download" | "Edit" | "Delete" | "Manage" | "Owner";
export type BlocksStorageEffect = "Allow" | "Deny";

export type BlocksStoragePermissionFlags = {
  canDelete: boolean;
  canDownload: boolean;
  canEdit: boolean;
  canManage: boolean;
  canOwner: boolean;
  canView: boolean;
};

export type BlocksStorageObject = {
  childDirectoryCount?: number;
  childFileCount?: number;
  contentType?: string;
  createdBy?: string;
  createdDate: string;
  currentVersion?: number;
  extension?: string;
  isDefault: boolean;
  itemId: string;
  lastUpdatedDate: string;
  name: string;
  parentDirectoryId?: string;
  permissions: BlocksStoragePermissionFlags;
  sizeInBytes: number;
  type: BlocksStorageObjectType;
};

export type BlocksStorageObjectsResponse = {
  hasMore: boolean;
  items: BlocksStorageObject[];
  nextCursor?: string;
  totalChildCount: number;
};

export type BlocksStorageObjectListRequest = {
  cursor?: string;
  limit?: number;
  moduleName?: number;
  parentDirectoryId?: string;
  search?: string;
  type?: BlocksStorageObjectType;
};

export type BlocksStorageObjectSearchRequest = {
  cursor?: string;
  directoryId?: string;
  limit?: number;
  query: string;
  type?: BlocksStorageObjectType;
};

export type BlocksStorageObjectPageRequest = {
  cursor?: string;
  limit?: number;
  type?: BlocksStorageObjectType;
};

export type BlocksDirectoryCreateRequest = {
  allowedFileExtensions?: string[];
  configurationName?: string;
  description?: string;
  moduleName?: number;
  name: string;
  parentDirectoryId?: string;
};

export type BlocksDirectoryUpdateRequest = {
  description?: string;
  directoryId: string;
  name?: string;
};

export type BlocksDirectoryDeleteRequest = {
  directoryId: string;
  permanent: boolean;
};

export type BlocksDirectoryMoveRequest = {
  directoryId: string;
  targetDirectoryId?: string;
};

export type BlocksFileVersionsRequest = {
  cursor?: string;
  fileId: string;
  limit?: number;
};

export type BlocksFileCreateVersionRequest = {
  configurationName?: string;
  fileId: string;
};

export type BlocksFileCopyRequest = {
  copyAccessPolicies?: boolean;
  fileId: string;
  targetDirectoryId: string;
};

export type BlocksFileMoveRequest = {
  fileId: string;
  targetDirectoryId: string;
};

export type BlocksFileRenameRequest = {
  fileId: string;
  name: string;
};

export type BlocksStorageResourceRequest = {
  resourceId: string;
};

export type BlocksStorageAccessPolicyRequest = {
  effect?: BlocksStorageEffect;
  expiresAt?: string;
  permission: BlocksStoragePermission;
  policyItemId?: string;
  principalId?: string;
  principalType: BlocksStoragePrincipalType;
  priority?: number;
  resourceId: string;
  resourceType: BlocksStorageResourceType;
};

export type BlocksStorageRevokeAccessRequest = {
  policyItemId: string;
  resourceId: string;
};

export type BlocksStorageToggleInheritanceRequest = {
  inheritsParentAccess: boolean;
  resourceId: string;
};

export type BlocksStorageShareRequest = {
  expiresAt?: string;
  permission: BlocksStoragePermission;
  principalId?: string;
  principalType: BlocksStoragePrincipalType;
  resourceId: string;
  resourceType: BlocksStorageResourceType;
};
