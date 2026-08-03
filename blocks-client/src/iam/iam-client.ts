import { BlocksHttpClient } from "../http/http-client.js";
import {
  BlocksBaseResponse,
  BlocksGetMyOrganizationsResponse,
  BlocksGetOrganizationResponse,
  BlocksGetOrganizationsResponse,
  BlocksGetPermissionResponse,
  BlocksGetPermissionsResponse,
  BlocksGetRoleResponse,
  BlocksGetRolesResponse,
  BlocksGetUserResponse,
  BlocksGetUsersResponse,
  BlocksIamListRequest,
  BlocksMeResponse
} from "./types.js";

export class BlocksIAMClient {
  constructor(private readonly http: BlocksHttpClient) {}

  /**
   * Current authenticated IAM account from `GET /iam/v4/iam/me`.
   * Use this for app profile bootstrapping because it returns the Blocks user record,
   * roles, permissions, and active organization context according to the access token.
   */
  me(): Promise<BlocksMeResponse> {
    return this.http.request<BlocksMeResponse>("/iam/v4/iam/me");
  }

  /**
   * Updates the current authenticated user's IAM profile through `POST /iam/v4/iam/me`.
   * The backend resolves the user id from the token; callers must not send another user's id.
   */
  updateMe(request: Record<string, unknown>): Promise<BlocksBaseResponse> {
    return this.http.request<BlocksBaseResponse>("/iam/v4/iam/me", { body: request });
  }

  users = {
    /**
     * What: creates a user through `POST /iam/v4/iam/users/create`.
     * Why: authorized admin UIs need to invite/provision users in the active tenant/organization.
     * How: pass IAM's create-user payload; caller permissions determine whether the API accepts it.
     */
    create: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/users/create", { body: request }),

    /**
     * What: updates a user through `POST /iam/v4/iam/users/{id}`.
     * Why: authorized admin UIs need to edit IAM profile fields.
     * How: pass the user id in the route and IAM's update payload in the body.
     */
    update: (id: string, request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>(`/iam/v4/iam/users/${encodeURIComponent(id)}`, { body: request }),

    /**
     * What: deactivates a user through `POST /iam/v4/iam/users/deactivate`.
     * Why: admin UIs need to remove access without deleting the user record.
     * How: pass IAM's deactivate payload for the target user.
     */
    deactivate: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/users/deactivate", { body: request }),

    /**
     * What: activates a user through `POST /iam/v4/iam/users/activate`.
     * Why: admin UIs need to restore access for a previously inactive account.
     * How: pass IAM's activate payload for the target user.
     */
    activate: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/users/activate", { body: request }),

    /**
     * What: queries users through `POST /iam/v4/iam/users`.
     * Why: IAM uses a POST-read contract for paging/filtering user lists.
     * How: pass `pageNo`, `pageSize`, search/filter fields, or the exact IAM list payload your UI needs.
     */
    list: (request: BlocksIamListRequest = {}): Promise<BlocksGetUsersResponse> =>
      this.http.request<BlocksGetUsersResponse>("/iam/v4/iam/users", { body: request }),

    /**
     * What: reads one user through `GET /iam/v4/iam/users/{id}`.
     * Why: user detail screens need one IAM user record, optionally for a specific organization context.
     * How: pass the user id and optional `organizationId`.
     */
    get: (id: string, options: { organizationId?: string } = {}): Promise<BlocksGetUserResponse> =>
      this.http.request<BlocksGetUserResponse>(`/iam/v4/iam/users/${encodeURIComponent(id)}`, {
        query: { organizationId: options.organizationId }
      }),

    /**
     * What: updates user access through `POST /iam/v4/iam/users/access`.
     * Why: admin UIs need to grant or change roles/permissions for a user.
     * How: pass IAM's access payload; the active token and tenant header define allowed scope.
     */
    updateAccess: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/users/access", { body: request }),

    /**
     * What: revokes user access through `POST /iam/v4/iam/users/revoke-access`.
     * Why: admin UIs need to remove roles/permissions or organization access.
     * How: pass IAM's revoke-access payload.
     */
    revokeAccess: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/users/revoke-access", { body: request }),

    /**
     * What: checks email availability through `GET /iam/v4/iam/email/available`.
     * Why: signup and invite forms can validate duplicate email state before submit.
     * How: pass the email query fields IAM expects; this is public but still sends `x-blocks-key`.
     */
    emailAvailable: (query: Record<string, string | undefined>): Promise<{ isAvailable?: boolean; IsAvailable?: boolean }> =>
      this.http.request<{ isAvailable?: boolean; IsAvailable?: boolean }>("/iam/v4/iam/email/available", {
        auth: false,
        query
      }),

    /**
     * What: checks whether a user exists through `GET /iam/v4/iam/users/exists`.
     * Why: account and invite flows may need an existence check by email.
     * How: pass the email string; the SDK sends it as the `email` query parameter.
     */
    exists: (email: string): Promise<unknown> =>
      this.http.request<unknown>("/iam/v4/iam/users/exists", { query: { email } })
  };

  permissions = {
    /**
     * What: creates a permission through `POST /iam/v4/iam/permissions/create`.
     * Why: authorized admin tooling may manage custom IAM permission definitions.
     * How: pass IAM's create-permission payload.
     */
    create: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/permissions/create", { body: request }),

    /**
     * What: updates a permission through `POST /iam/v4/iam/permissions/{id}`.
     * Why: admin tooling may need to edit permission metadata.
     * How: pass the permission id and IAM's update payload.
     */
    update: (id: string, request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>(`/iam/v4/iam/permissions/${encodeURIComponent(id)}`, { body: request }),

    /**
     * What: queries permissions through `POST /iam/v4/iam/permissions`.
     * Why: IAM uses a POST-read contract for permission paging/filtering.
     * How: pass `pageNo`, `pageSize`, search/filter fields, or IAM's exact list payload.
     */
    list: (request: BlocksIamListRequest = {}): Promise<BlocksGetPermissionsResponse> =>
      this.http.request<BlocksGetPermissionsResponse>("/iam/v4/iam/permissions", { body: request }),

    /**
     * What: groups permissions by severity through `GET /iam/v4/iam/permissions/by-severity`.
     * Why: role/access UIs often display permissions grouped by risk or category.
     * How: call after an authorized token is available.
     */
    bySeverity: (): Promise<unknown[]> =>
      this.http.request<unknown[]>("/iam/v4/iam/permissions/by-severity"),

    /**
     * What: reads one permission through `GET /iam/v4/iam/permissions/{id}`.
     * Why: admin detail/edit screens need one permission record.
     * How: pass the permission id from IAM.
     */
    get: (id: string): Promise<BlocksGetPermissionResponse> =>
      this.http.request<BlocksGetPermissionResponse>(`/iam/v4/iam/permissions/${encodeURIComponent(id)}`)
  };

  roles = {
    /**
     * What: creates a role through `POST /iam/v4/iam/roles/create`.
     * Why: admin UIs need to define permission bundles users can be assigned to.
     * How: pass IAM's create-role payload.
     */
    create: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/roles/create", { body: request }),

    /**
     * What: updates a role through `POST /iam/v4/iam/roles/update`.
     * Why: admin UIs need to edit role names, metadata, or other IAM-supported fields.
     * How: pass IAM's role update payload.
     */
    update: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/roles/update", { body: request }),

    /**
     * What: queries roles through `POST /iam/v4/iam/roles`.
     * Why: IAM uses a POST-read contract for role paging/filtering.
     * How: pass `pageNo`, `pageSize`, search/filter fields, or IAM's exact list payload.
     */
    list: (request: BlocksIamListRequest = {}): Promise<BlocksGetRolesResponse> =>
      this.http.request<BlocksGetRolesResponse>("/iam/v4/iam/roles", { body: request }),

    /**
     * What: reads one role through `GET /iam/v4/iam/roles/{id}`.
     * Why: role detail/edit screens need one IAM role record.
     * How: pass the role id from IAM.
     */
    get: (id: string): Promise<BlocksGetRoleResponse> =>
      this.http.request<BlocksGetRoleResponse>(`/iam/v4/iam/roles/${encodeURIComponent(id)}`),

    /**
     * What: assigns permissions to a role through `POST /iam/v4/iam/roles/assign-permissions`.
     * Why: role editors need to attach or replace permission sets.
     * How: pass IAM's assign-permissions payload.
     */
    assignPermissions: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/roles/assign-permissions", { body: request }),

    /**
     * What: lists assignable roles through `GET /iam/v4/iam/roles/assignable`.
     * Why: user-access UIs should only show roles the current user can assign.
     * How: call after an authorized token is available.
     */
    assignable: (): Promise<unknown> =>
      this.http.request<unknown>("/iam/v4/iam/roles/assignable")
  };

  resources = {
    /**
     * What: lists resource groups through `GET /iam/v4/iam/resource-groups`.
     * Why: permission screens need resource grouping metadata for navigation and display.
     * How: call after an authorized token is available.
     */
    groups: (): Promise<unknown[]> =>
      this.http.request<unknown[]>("/iam/v4/iam/resource-groups"),

    /**
     * What: lists feature/resource flags through `GET /iam/v4/iam/resource/features`.
     * Why: frontends use this to feature-gate UI based on current roles and permissions.
     * How: pass optional query fields supported by IAM; the active token defines the user context.
     */
    features: (query: Record<string, string | number | boolean | undefined> = {}): Promise<unknown[]> =>
      this.http.request<unknown[]>("/iam/v4/iam/resource/features", { query })
  };

  organizations = {
    /**
     * What: creates an organization through `POST /iam/v4/iam/organizations/create`.
     * Why: authorized admin UIs may need tenant organization management.
     * How: pass IAM's create-organization payload.
     */
    create: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/organizations/create", { body: request }),

    /**
     * What: updates an organization through `POST /iam/v4/iam/organizations/{id}`.
     * Why: organization settings screens need to edit metadata/config.
     * How: pass the organization id and IAM's update payload.
     */
    update: (id: string, request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>(`/iam/v4/iam/organizations/${encodeURIComponent(id)}`, { body: request }),

    /**
     * What: lists organizations through `GET /iam/v4/iam/organizations`.
     * Why: admin UIs need organization browsing and selection.
     * How: pass IAM-supported query fields such as paging/search options.
     */
    list: (query: Record<string, string | number | boolean | undefined> = {}): Promise<BlocksGetOrganizationsResponse> =>
      this.http.request<BlocksGetOrganizationsResponse>("/iam/v4/iam/organizations", { query }),

    /**
     * What: reads one organization through `GET /iam/v4/iam/organizations/{id}`.
     * Why: organization detail screens need one organization record.
     * How: pass the organization id from IAM.
     */
    get: (id: string): Promise<BlocksGetOrganizationResponse> =>
      this.http.request<BlocksGetOrganizationResponse>(`/iam/v4/iam/organizations/${encodeURIComponent(id)}`),

    /**
     * What: lists current-user organizations through `GET /iam/v4/iam/organizations/my`.
     * Why: apps need available organizations for org switchers and context selectors.
     * How: call with the current user's access token.
     */
    my: (): Promise<BlocksGetMyOrganizationsResponse> =>
      this.http.request<BlocksGetMyOrganizationsResponse>("/iam/v4/iam/organizations/my"),

    /**
     * What: reads organization configuration through `GET /iam/v4/iam/organizations/config`.
     * Why: settings screens need the active organization's current configuration.
     * How: call with an authorized token in the desired organization context.
     */
    getConfig: (): Promise<Record<string, unknown>> =>
      this.http.request<Record<string, unknown>>("/iam/v4/iam/organizations/config"),

    /**
     * What: saves organization configuration through `POST /iam/v4/iam/organizations/config`.
     * Why: settings screens need to persist organization-level behavior.
     * How: pass IAM's organization config payload.
     */
    saveConfig: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/organizations/config", { body: request })
  };

  signupSettings = {
    /**
     * What: reads signup settings through `GET /iam/v4/iam/signup-settings`.
     * Why: public signup screens need tenant policy before a user is authenticated.
     * How: call without an access token; the SDK still sends `x-blocks-key`.
     */
    get: (): Promise<Record<string, unknown>> =>
      this.http.request<Record<string, unknown>>("/iam/v4/iam/signup-settings", { auth: false }),

    /**
     * What: saves signup settings through `POST /iam/v4/iam/signup-settings`.
     * Why: admin/settings screens need to configure signup policy.
     * How: pass IAM's signup-settings payload with an authorized token.
     */
    save: (request: Record<string, unknown>): Promise<BlocksBaseResponse> =>
      this.http.request<BlocksBaseResponse>("/iam/v4/iam/signup-settings", { body: request })
  };
}
