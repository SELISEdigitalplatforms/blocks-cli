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

// Project metadata (Project/Gets, Project/GetAsset) always uses the account
// token, never the impersonated project token -- these endpoints operate at
// the account/tenant-group level, above any single project's own API surface.
export async function listProjectGroups(flags: Record<string, string | boolean>): Promise<ProjectGroupRecord[]> {
  return blocksRequest<ProjectGroupRecord[]>("/os/v4/Project/Gets", {
    accountAuth: true,
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
// or 'blocks-os use') and looks it up via Project/Gets. Throws the same
// actionable "No project selected" error as selectedProject() when nothing
// is selected -- callers should not catch that error, letting it surface to
// the user with the "run blocks-os use <tenantId>" next step intact.
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
    accountAuth: true,
    query: { page: 0, pageSize: 100, tenantGroupId },
    ...requestContext(flags)
  });
}
