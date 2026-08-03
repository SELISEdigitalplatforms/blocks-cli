export type BlocksBaseResponse = Record<string, unknown> & {
  errors?: unknown;
  isSuccess?: boolean;
  message?: string;
};

export type BlocksQueryResponse<T = unknown> = BlocksBaseResponse & {
  data?: T;
};

export type BlocksQueryListResponse<T = unknown> = BlocksBaseResponse & {
  data?: T[];
  pageNo?: number;
  pageSize?: number;
  totalCount?: number;
};

export type BlocksUser = Record<string, unknown> & {
  active?: boolean;
  email?: string;
  firstName?: string;
  itemId?: string;
  language?: string;
  lastName?: string;
  permissions?: string[];
  roles?: string[];
  status?: number;
};

export type BlocksPermission = Record<string, unknown> & {
  itemId?: string;
  resource?: string;
  roles?: string[];
};

export type BlocksRole = Record<string, unknown> & {
  itemId?: string;
  name?: string;
  slug?: string;
};

export type BlocksOrganization = Record<string, unknown> & {
  itemId?: string;
  name?: string;
};

export type BlocksIamListRequest<TFilter = Record<string, unknown>> = Record<string, unknown> & {
  filter?: TFilter;
  pageNo?: number;
  pageNumber?: number;
  pageSize?: number;
  search?: string;
};

export type BlocksMeResponse = BlocksQueryResponse<BlocksUser>;
export type BlocksGetUserResponse = BlocksQueryResponse<BlocksUser>;
export type BlocksGetUsersResponse = BlocksQueryListResponse<BlocksUser>;
export type BlocksGetPermissionResponse = BlocksQueryResponse<BlocksPermission>;
export type BlocksGetPermissionsResponse = BlocksQueryListResponse<BlocksPermission>;
export type BlocksGetRoleResponse = BlocksQueryResponse<BlocksRole>;
export type BlocksGetRolesResponse = BlocksQueryListResponse<BlocksRole>;
export type BlocksGetOrganizationResponse = BlocksQueryResponse<BlocksOrganization>;
export type BlocksGetOrganizationsResponse = BlocksQueryListResponse<BlocksOrganization>;
export type BlocksGetMyOrganizationsResponse = BlocksQueryResponse<BlocksOrganization[]>;
