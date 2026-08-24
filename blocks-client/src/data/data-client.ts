import { BlocksHttpClient } from "../http/http-client.js";
import {
  BlocksDataCollection,
  BlocksDataCollectionOptions,
  BlocksDataListOptions,
  BlocksDirectoryCreateRequest,
  BlocksDirectoryDeleteRequest,
  BlocksDirectoryMoveRequest,
  BlocksDirectoryUpdateRequest,
  BlocksFileCopyRequest,
  BlocksFileCreateVersionRequest,
  BlocksFileDeleteRequest,
  BlocksFileGetOptions,
  BlocksFileInfoListRequest,
  BlocksFileMoveRequest,
  BlocksFileRenameRequest,
  BlocksFileVersionsRequest,
  BlocksDataSchema,
  BlocksFileListRequest,
  BlocksFileUpdateAdditionalInfoRequest,
  BlocksFileUploadRequest,
  BlocksGraphqlRequest,
  BlocksLocalStorageUploadRequest,
  BlocksPagedResult,
  BlocksRegexGenerateRequest,
  BlocksSchemaFieldValidationOptions,
  BlocksSchemaListOptions,
  BlocksSchemaValidationListOptions,
  BlocksStorageAccessPolicyRequest,
  BlocksStorageObjectListRequest,
  BlocksStorageObjectPageRequest,
  BlocksStorageObjectSearchRequest,
  BlocksStorageObjectsResponse,
  BlocksStorageResourceRequest,
  BlocksStorageRevokeAccessRequest,
  BlocksStorageShareRequest,
  BlocksStorageToggleInheritanceRequest,
  BlocksUploadToUrlRequest
} from "./types.js";

const DATA_API = "/data/v4";

export class BlocksDataClient {
  constructor(private readonly http: BlocksHttpClient) {}

  schemas = {
    /**
     * What: lists Data schemas through `GET /data/v4/schemas`.
     * Why: runtime apps and form builders need to discover available collections/schema metadata.
     * How: pass optional paging/filter fields; tenant routing always uses the `x-blocks-key` header, never `ProjectKey`.
     */
    list: (options: BlocksSchemaListOptions = {}): Promise<BlocksPagedResult<BlocksDataSchema>> => this.http.request(`${DATA_API}/schemas`, {
      query: schemaListQuery(options)
    }),

    /**
     * What: looks up one schema by name through `GET /data/v4/schemas`.
     * Why: apps often need a compact schema lookup before rendering a single collection/form.
     * How: pass the schema name; the SDK sends `SchemaName`, `PageNo=1`, and `PageSize=1`.
     */
    get: (schemaName: string): Promise<BlocksPagedResult<BlocksDataSchema>> => this.http.request(`${DATA_API}/schemas`, {
      query: { PageNo: 1, PageSize: 1, SchemaName: schemaName }
    }),

    /**
     * What: reads schema summary/aggregation through `GET /data/v4/schemas/aggregation`.
     * Why: frontend admin/runtime dashboards may need schema list plus access-level summary in one response.
     * How: pass the same list filters as `schemas.list`; the SDK does not send `ProjectKey`.
     */
    aggregation: (options: BlocksSchemaListOptions = {}): Promise<unknown> => this.http.request(`${DATA_API}/schemas/aggregation`, {
      query: schemaListQuery(options)
    }),

    /**
     * What: reads one schema definition by id through `GET /data/v4/schemas/get-by-id`.
     * Why: detail views need exact schema metadata when they already have the schema item id.
     * How: pass the schema id; the SDK sends it as the `id` query parameter.
     */
    getById: (id: string): Promise<unknown> => this.http.request(`${DATA_API}/schemas/get-by-id`, {
      query: { id }
    }),

    /**
     * What: reads general schema info through `GET /data/v4/schemas/info`.
     * Why: generic runtime UIs can bootstrap schema metadata without naming a single schema.
     * How: call after configuring `accessToken`; the SDK sends only auth plus `x-blocks-key`.
     */
    info: (): Promise<unknown> => this.http.request(`${DATA_API}/schemas/info`),

    /**
     * What: reads detailed schema info through `GET /data/v4/schemas/info-by-name`.
     * Why: dynamic forms/tables need field-level metadata for one schema.
     * How: pass the schema name; the SDK sends it as `schemaName`.
     */
    infoByName: (schemaName: string): Promise<unknown> => this.http.request(`${DATA_API}/schemas/info-by-name`, {
      query: { schemaName }
    })
  };

  files = {
    /**
     * What: reads one file record through the current file download operation.
     * Why: frontend views need file metadata or a downloadable reference by file id.
     * How: pass `fileId` and optional Data file configuration/version fields.
     */
    get: (fileId: string, options: BlocksFileGetOptions = {}): Promise<unknown> => this.http.request(`${DATA_API}/files/get-file`, {
      query: {
        ConfigurationName: options.configurationName,
        FileId: fileId,
        Version: options.version
      }
    }),

    /**
     * What: batch-reads file metadata and download URLs.
     * Why: pages with many attachments should avoid one request per file.
     * How: pass the file-list payload exactly as Data expects; the SDK does not inject project fields.
     */
    getMany: (request: BlocksFileListRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/get-files`, {
      body: normalizeFileListRequest(request)
    }),

    /**
     * What: lists file records and metadata.
     * Why: storage browsers and attachment managers need paged file metadata before downloading content.
     * How: pass paging, sort, and filter fields; the SDK sends your request without any `projectKey`.
     */
    info: (request: BlocksFileInfoListRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/get-files-info`, {
      body: withoutProjectKey(request)
    }),

    /**
     * What: creates file/version metadata and requests a pre-signed upload URL.
     * Why: browser apps should upload binary content through the URL issued by Blocks Data.
     * How: pass file metadata plus a parent directory id or module default.
     */
    presignedUploadUrl: (request: BlocksFileUploadRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/get-pre-signed-url-for-upload`, {
      body: normalizeUploadRequest(request)
    }),

    /**
     * What: uploads binary content to a pre-signed storage URL.
     * Why: the actual blob upload goes to cloud/object storage, not to the Blocks API host.
     * How: pass the `uploadUrl` returned by `presignedUploadUrl` plus a `Blob`, stream, or buffer; this call sends no `x-blocks-key` or bearer token.
     */
    uploadToUrl: (request: BlocksUploadToUrlRequest): Promise<unknown> => {
      const headers = new Headers(request.headers);
      if (request.contentType && !headers.has("Content-Type")) headers.set("Content-Type", request.contentType);
      if (!headers.has("x-ms-blob-type")) headers.set("x-ms-blob-type", "Blockblob");
      return this.http.external(request.url, {
        body: request.body as BodyInit,
        headers,
        method: "PUT"
      });
    },

    /**
     * What: creates a file/version and uploads its bytes to local storage.
     * Why: local-storage deployments need multipart upload through Blocks Data instead of a pre-signed cloud URL.
     * How: pass a `Blob`/`File` and metadata; the SDK builds `FormData` and does not add `projectKey`.
     */
    uploadToLocalStorage: (request: BlocksLocalStorageUploadRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/upload-file-to-local-storage`, {
      body: toLocalStorageFormData(request),
      headers: {}
    }),

    /**
     * What: moves a file to trash or permanently deletes it.
     * Why: storage UIs need to remove files when permissions and Data rules allow it.
     * How: pass `fileId` and an explicit `permanent` choice; false moves to trash.
     */
    delete: (request: BlocksFileDeleteRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/delete-file`, {
      body: withoutProjectKey(request)
    }),

    /**
     * What: updates file additional properties.
     * Why: apps often need to attach searchable metadata such as agent status or business references to a file.
     * How: pass `itemId` and `additionalProperties`; the SDK forwards the request as-is except for not adding project fields.
     */
    updateAdditionalInfo: (request: BlocksFileUpdateAdditionalInfoRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/update-file-additional-info`, {
      body: withoutProjectKey(request)
    }),

    versions: (request: BlocksFileVersionsRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/get-file-versions`, {
      query: request
    }),

    createVersion: (request: BlocksFileCreateVersionRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/create-file-version`, {
      body: request
    }),

    copy: (request: BlocksFileCopyRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/copy-file`, {
      body: request
    }),

    move: (request: BlocksFileMoveRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/move-file`, {
      body: request
    }),

    rename: (request: BlocksFileRenameRequest): Promise<unknown> => this.http.request(`${DATA_API}/files/rename-file`, {
      body: request
    })
  };

  directories = {
    create: (request: BlocksDirectoryCreateRequest): Promise<unknown> => this.http.request(`${DATA_API}/directory/create-directory`, {
      body: request
    }),

    get: (directoryId: string): Promise<unknown> => this.http.request(`${DATA_API}/directory/get-directory`, {
      query: { directoryId }
    }),

    update: (request: BlocksDirectoryUpdateRequest): Promise<unknown> => this.http.request(`${DATA_API}/directory/update-directory`, {
      body: request
    }),

    delete: (request: BlocksDirectoryDeleteRequest): Promise<unknown> => this.http.request(`${DATA_API}/directory/delete-directory`, {
      body: request
    }),

    move: (request: BlocksDirectoryMoveRequest): Promise<unknown> => this.http.request(`${DATA_API}/directory/move-directory`, {
      body: request
    })
  };

  objects = {
    list: (request: BlocksStorageObjectListRequest = {}): Promise<BlocksStorageObjectsResponse> => this.http.request(`${DATA_API}/objects/get-objects`, {
      query: request
    }),

    search: (request: BlocksStorageObjectSearchRequest): Promise<BlocksStorageObjectsResponse> => this.http.request(`${DATA_API}/objects/search-objects`, {
      query: request
    }),

    trash: (request: BlocksStorageObjectPageRequest = {}): Promise<BlocksStorageObjectsResponse> => this.http.request(`${DATA_API}/objects/get-trash`, {
      query: request
    }),

    shared: (request: BlocksStorageObjectPageRequest = {}): Promise<BlocksStorageObjectsResponse> => this.http.request(`${DATA_API}/objects/get-shared-objects`, {
      query: request
    }),

    restore: (request: BlocksStorageResourceRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/restore-from-trash`, {
      body: request
    }),

    deleteFromTrash: (request: BlocksStorageResourceRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/delete-from-trash`, {
      body: request
    }),

    accessPolicies: (resourceId: string): Promise<unknown> => this.http.request(`${DATA_API}/objects/get-access-policies`, {
      query: { resourceId }
    }),

    grantAccess: (request: BlocksStorageAccessPolicyRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/grant-access`, {
      body: request
    }),

    updateAccess: (request: BlocksStorageAccessPolicyRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/update-access-policy`, {
      body: request
    }),

    revokeAccess: (request: BlocksStorageRevokeAccessRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/revoke-access-policy`, {
      body: request
    }),

    resolveAccess: (resourceId: string): Promise<unknown> => this.http.request(`${DATA_API}/objects/resolve-access`, {
      query: { resourceId }
    }),

    toggleInheritance: (request: BlocksStorageToggleInheritanceRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/toggle-inheritance`, {
      body: request
    }),

    share: (request: BlocksStorageShareRequest): Promise<unknown> => this.http.request(`${DATA_API}/objects/share-object`, {
      body: request
    })
  };

  validations = {
    /**
     * What: lists field validation rules through `GET /data/v4/data-validations`.
     * Why: dynamic forms can render backend validation rules for schema fields.
     * How: pass optional schema/field/paging filters; the SDK does not send `ProjectKey`.
     */
    list: (options: BlocksSchemaValidationListOptions = {}): Promise<unknown> => this.http.request(`${DATA_API}/data-validations`, {
      query: validationListQuery(options)
    }),

    /**
     * What: reads one validation rule through `GET /data/v4/data-validations/get-by-id`.
     * Why: validation detail screens need one rule by id.
     * How: pass the validation id.
     */
    getById: (id: string): Promise<unknown> => this.http.request(`${DATA_API}/data-validations/get-by-id`, {
      query: { id }
    }),

    /**
     * What: reads all validations for a schema through `GET /data/v4/data-validations/by-schema-id`.
     * Why: form builders and runtime renderers need the validation set for one schema.
     * How: pass the schema id.
     */
    bySchemaId: (schemaId: string): Promise<unknown> => this.http.request(`${DATA_API}/data-validations/by-schema-id`, {
      query: { schemaId }
    }),

    /**
     * What: reads validation for one schema field through `GET /data/v4/data-validations/by-schema-and-field`.
     * Why: field renderers can load rules lazily for a single field.
     * How: pass `schemaId` and `fieldName`.
     */
    bySchemaAndField: (options: BlocksSchemaFieldValidationOptions): Promise<unknown> => this.http.request(`${DATA_API}/data-validations/by-schema-and-field`, {
      query: options
    })
  };

  /**
   * What: executes a GraphQL operation through `POST /data/v4/gateway`.
   * Why: the Data Gateway runtime exposes schema-backed collections through GraphQL with tenant-aware access controls.
   * How: pass `query`, optional `variables`, optional `operationName`, and optional headers such as `x-graphql-playground`.
   */
  graphql(request: BlocksGraphqlRequest): Promise<unknown> {
    return this.http.request(`${DATA_API}/gateway`, {
      body: {
        operationName: request.operationName,
        query: request.query,
        variables: request.variables
      },
      headers: request.headers
    });
  }

  utilities = {
    /**
     * What: generates a regex pattern through `POST /data/v4/regex/generate-regex`.
     * Why: schema/form builders can ask Blocks Data for a validation regex suggestion.
     * How: pass a text `description` and optional constraints; the SDK returns the generated pattern response.
     */
    generateRegex: (request: BlocksRegexGenerateRequest): Promise<unknown> => this.http.request(`${DATA_API}/regex/generate-regex`, {
      body: request
    }),

    /**
     * What: reads mock data through `GET /data/v4/mock-data`.
     * Why: development/test UIs may need sample data exposed by Blocks Data.
     * How: call with an authorized token; this is read-only and does not mutate stored mock data.
     */
    mockData: (): Promise<unknown> => this.http.request(`${DATA_API}/mock-data`)
  };

  /**
   * What: creates CRUD helpers for a Data runtime collection.
   * Why: frontend code usually works with schema names rather than hand-written GraphQL operations.
   * How: pass the exact schema name, such as `Product`; returned helpers call `/data/v4/gateway` and never add `ProjectKey`.
   */
  collection<T = Record<string, unknown>>(schemaName: string, options: BlocksDataCollectionOptions = {}): BlocksDataCollection<T> {
    assertGraphqlName(schemaName, "schemaName");
    const listField = `get${schemaName}s`;
    const createField = `insert${schemaName}`;
    const updateField = `update${schemaName}`;
    const deleteField = `delete${schemaName}`;

    return {
      /**
       * What: creates a schema-backed item through `POST /data/v4/gateway`.
       * Why: forms need a direct runtime create operation.
       * How: pass the item payload; Data validates it against the active schema's insert input.
       */
      create: (payload) => this.graphql({
        operationName: createField,
        query: `mutation ${createField}($input: ${schemaName}InsertInput!) {
  ${createField}(input: $input) {
    acknowledged
    itemId
    message
    totalImpactedData
  }
}`,
        variables: { input: payload }
      }),

      /**
       * What: deletes a schema-backed item through `POST /data/v4/gateway`.
       * Why: collection UIs need a runtime delete operation when allowed by permissions/rules.
       * How: pass the item id from Data; the SDK sends a GraphQL `filter` on `ItemId`.
       */
      delete: (itemId, deleteOptions = {}) => this.graphql({
        operationName: deleteField,
        query: `mutation ${deleteField}($filter: String, $input: ${schemaName}DeleteInput!) {
  ${deleteField}(filter: $filter, input: $input) {
    acknowledged
    itemId
    message
    totalImpactedData
  }
}`,
        variables: {
          filter: itemIdFilter(itemId),
          input: { isHardDelete: deleteOptions.hardDelete ?? false }
        }
      }),

      /**
       * What: reads one schema-backed item through `POST /data/v4/gateway`.
       * Why: detail pages need one runtime record by id.
       * How: pass the item id from Data; the SDK queries `get{SchemaName}s` with an `ItemId` filter.
       */
      get: (itemId, getOptions = {}) => this.graphql({
        operationName: listField,
        query: collectionListQuery(listField, selectionFor(getOptions.fields ?? options.fields)),
        variables: {
          input: {
            filter: itemIdFilter(itemId),
            pageNo: 1,
            pageSize: 1
          }
        }
      }),

      /**
       * What: lists schema-backed items through `POST /data/v4/gateway`.
       * Why: tables, grids, and pickers need paged runtime records.
       * How: pass `pageNo`, `pageSize`, optional `filter`/`sort`, and GraphQL fields to select.
       */
      list: (listOptions?: BlocksDataListOptions) => this.graphql({
        operationName: listField,
        query: collectionListQuery(listField, selectionFor(listOptions?.fields ?? options.fields)),
        variables: {
          input: dynamicQueryInput(listOptions)
        }
      }),

      /**
       * What: updates a schema-backed item through `POST /data/v4/gateway`.
       * Why: edit forms need a runtime update operation.
       * How: pass the item id and partial payload; the SDK sends a GraphQL `filter` on `ItemId`.
       */
      update: (itemId, payload) => this.graphql({
        operationName: updateField,
        query: `mutation ${updateField}($filter: String, $input: ${schemaName}UpdateInput!) {
  ${updateField}(filter: $filter, input: $input) {
    acknowledged
    itemId
    message
    totalImpactedData
  }
}`,
        variables: {
          filter: itemIdFilter(itemId),
          input: payload
        }
      })
    };
  }
}

function normalizeFileListRequest(request: BlocksFileListRequest): Record<string, unknown> {
  const record = withoutProjectKey(request);
  if (request.fileIds && !record.FileIds) record.FileIds = request.fileIds;
  delete record.fileIds;
  return record;
}

function schemaListQuery(options: BlocksSchemaListOptions): Record<string, boolean | number | string | undefined> {
  return {
    CollectionName: options.collectionName,
    Keyword: options.keyword,
    PageNo: options.pageNo ?? 1,
    PageSize: options.pageSize ?? 100,
    SchemaName: options.schemaName,
    SchemaType: options.schemaType,
    SortBy: options.sortBy,
    SortDescending: options.sortDescending
  };
}

function validationListQuery(options: BlocksSchemaValidationListOptions): Record<string, boolean | number | string | undefined> {
  return {
    FieldName: options.fieldName,
    Keyword: options.keyword,
    PageNo: options.pageNo ?? 1,
    PageSize: options.pageSize ?? 100,
    SchemaId: options.schemaId,
    SortBy: options.sortBy,
    SortDescending: options.sortDescending
  };
}

function normalizeUploadRequest(request: BlocksFileUploadRequest): Record<string, unknown> {
  const record = withoutProjectKey(request);
  if (request.fileName && !record.Name) record.Name = request.fileName;
  if (request.name && !record.Name) record.Name = request.name;
  if (request.itemId && !record.ItemId) record.ItemId = request.itemId;
  if (request.metaData && !record.MetaData) record.MetaData = request.metaData;
  if (request.parentDirectoryId && !record.ParentDirectoryId) record.ParentDirectoryId = request.parentDirectoryId;
  if (request.tags && !record.Tags) record.Tags = request.tags;
  if (request.accessModifier && !record.AccessModifier) record.AccessModifier = request.accessModifier;
  if (request.configurationName && !record.ConfigurationName) record.ConfigurationName = request.configurationName;
  if (request.moduleName !== undefined && !record.ModuleName) record.ModuleName = request.moduleName;
  if (request.additionalProperties && !record.AdditionalProperties) record.AdditionalProperties = request.additionalProperties;

  delete record.fileName;
  delete record.contentType;
  delete record.name;
  delete record.itemId;
  delete record.metaData;
  delete record.parentDirectoryId;
  delete record.tags;
  delete record.accessModifier;
  delete record.configurationName;
  delete record.moduleName;
  delete record.additionalProperties;
  return record;
}

function toLocalStorageFormData(request: BlocksLocalStorageUploadRequest): FormData {
  const form = new FormData();
  appendFormValue(form, "File", request.file);
  appendFormValue(form, "Name", request.name);
  appendFormValue(form, "ItemId", request.itemId);
  appendFormValue(form, "MetaData", request.metaData);
  appendFormValue(form, "ParentDirectoryId", request.parentDirectoryId);
  appendFormValue(form, "Tags", Array.isArray(request.tags) ? request.tags.join(",") : request.tags);
  appendFormValue(form, "AccessModifier", request.accessModifier);
  appendFormValue(form, "ConfigurationName", request.configurationName);
  if (request.additionalProperties) {
    for (const [key, value] of Object.entries(request.additionalProperties)) {
      form.append(`AdditionalProperties[${key}]`, value);
    }
  }
  return form;
}

function appendFormValue(form: FormData, key: string, value: Blob | number | string | undefined): void {
  if (value === undefined) return;
  form.append(key, value instanceof Blob ? value : String(value));
}

function withoutProjectKey(request: Record<string, unknown>): Record<string, unknown> {
  const record = { ...request };
  delete record.projectKey;
  delete record.ProjectKey;
  return record;
}

function dynamicQueryInput(options?: BlocksDataListOptions): Record<string, unknown> {
  return {
    filter: normalizeGraphqlJsonInput(options?.filter ?? options?.query),
    pageNo: options?.pageNo ?? 1,
    pageSize: options?.pageSize ?? 20,
    sort: normalizeGraphqlJsonInput(options?.sort)
  };
}

function collectionListQuery(fieldName: string, selection: string): string {
  return `query ${fieldName}($input: DynamicQueryInput) {
  ${fieldName}(input: $input) {
    items {
${indent(selection, 6)}
    }
    totalCount
    pageNo
    pageSize
    totalPages
    hasNextPage
    hasPreviousPage
  }
}`;
}

function selectionFor(fields?: string[]): string {
  const selected = fields?.length ? fields : ["ItemId"];
  const unique = Array.from(new Set(["ItemId", ...selected]));
  for (const field of unique) assertGraphqlName(field, "field");
  return unique.join("\n");
}

function itemIdFilter(itemId: string): string {
  return JSON.stringify({ ItemId: itemId });
}

function normalizeGraphqlJsonInput(value: Record<string, unknown> | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function assertGraphqlName(value: string, label: string): void {
  if (!/^[_A-Za-z][_0-9A-Za-z]*$/.test(value)) {
    throw new Error(`Invalid Blocks Data GraphQL ${label}: ${value}`);
  }
}

function indent(value: string, spaces: number): string {
  const pad = " ".repeat(spaces);
  return value.split("\n").map((line) => `${pad}${line}`).join("\n");
}
