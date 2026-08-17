import { blocksRequest } from "./api.js";
import { requestContext } from "./request-context.js";
import { selectedProject } from "./workspace.js";

export type ProjectRecord = {
  applications?: Array<{ domain?: string }>;
  environment?: string;
  name?: string;
  tenantId?: string;
} & Record<string, unknown>;

export type ProjectGroupRecord = {
  name?: string;
  projects?: ProjectRecord[];
  tenantGroupId?: string;
} & Record<string, unknown>;

export type TenantAssetResponse = {
  assets?: {
    resources?: Array<{ link?: string; name?: string; resourceId?: string }>;
  };
};

// Project metadata (Project/Gets, Project/GetAsset) is authorized at the
// account/tenant-group level, above any single project's own API surface --
// but the platform's permission check rebuilds to the root tenant while
// impersonating, and the underlying query filters by user id rather than
// tenant, so the impersonated project session works here too. Prefer it when
// a project is selected (avoids an extra account-session refresh mid-project
// work); fall back to the account token when nothing is selected yet.
export async function listProjectGroups(flags: Record<string, string | boolean>): Promise<ProjectGroupRecord[]> {
  return blocksRequest<ProjectGroupRecord[]>("/os/v4/Project/Gets", {
    preferImpersonatedProjectAuth: true,
    query: { page: 0, pageSize: 100, tenantGroupId: "" },
    ...requestContext(flags)
  });
}

export async function findProjectByTenantId(
  tenantId: string,
  flags: Record<string, string | boolean>
): Promise<{ group: ProjectGroupRecord; project: ProjectRecord }> {
  const groups = await listProjectGroups(flags);

  for (const group of groups) {
    const project = (group.projects ?? []).find((item) => item.tenantId === tenantId);
    if (project) return { group, project };
  }

  throw new Error(`Project '${tenantId}' was not found in Project/Gets.`);
}

// Resolves the CLI's currently selected project (blocks.json, --project flag,
// or 'blocks use') and looks it up via Project/Gets. Throws the same
// actionable "No project selected" error as selectedProject() when nothing
// is selected -- callers should not catch that error, letting it surface to
// the user with the "run blocks use <tenantId>" next step intact.
export async function resolveSelectedProject(
  flags: Record<string, string | boolean>
): Promise<{ group: ProjectGroupRecord; project: ProjectRecord; tenantId: string }> {
  const tenantId = await selectedProject(flags);
  const { group, project } = await findProjectByTenantId(tenantId, flags);
  return { group, project, tenantId };
}

export async function getProjectAssets(
  tenantGroupId: string,
  flags: Record<string, string | boolean>
): Promise<TenantAssetResponse> {
  return blocksRequest<TenantAssetResponse>("/os/v4/Project/GetAsset", {
    preferImpersonatedProjectAuth: true,
    query: { page: 0, pageSize: 100, tenantGroupId },
    ...requestContext(flags)
  });
}
