import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

type ProjectGroup = {
  projects?: Array<{ environment?: string; tenantId?: string }>;
  tenantGroupId?: string;
};

type TenantAssetResponse = {
  assets?: {
    resources?: Array<{ link?: string; name?: string; resourceId?: string }>;
  };
};

type RepoDetailsResponse = {
  data?: {
    repo?: { branch?: string; repoUrl?: string };
  };
};

export async function releaseDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const domain = stringFlag(flags, "domain");
  const dryRun = booleanFlag(flags, "dry-run");

  const projectKey = await selectedProject(flags);
  const { environment, tenantGroupId } = await resolveProjectContext(projectKey, flags);
  const repoId = await resolveRepoId(tenantGroupId, environment, flags);
  const { branch, repoUrl } = await resolveRepoBranch(repoId, projectKey, flags);

  if (branch.toLowerCase() !== environment.toLowerCase()) {
    throw new CliActionableError(
      `Connected repo's branch '${branch}' does not match this project's environment '${environment}'.`,
      "branch_environment_mismatch",
      `Point the linked repo at a branch named '${environment}', or relink the correct branch from the Blocks portal.`
    );
  }

  if (dryRun) {
    writeOutput(
      {
        branch,
        domain: domain || undefined,
        dryRun: true,
        environment,
        projectKey,
        repoId
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Deploy '${environment}' (repo ${repoId}, branch ${branch}).`);

  if (domain) {
    await blocksRequest<unknown>("/release/v4/api/Build/repo-update", {
      body: {
        projectEnv: environment,
        repoWithDomains: [{ customDeploymentDomain: domain, repoId, repoUrl }]
      },
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  }

  const result = await blocksRequest<unknown>("/release/v4/api/Build/manual", {
    body: { repoId },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}

async function resolveProjectContext(
  tenantId: string,
  flags: Record<string, string | boolean>
): Promise<{ environment: string; tenantGroupId: string }> {
  const groups = await blocksRequest<ProjectGroup[]>("/os/v4/Project/Gets", {
    accountAuth: true,
    query: { page: 0, pageSize: 100, tenantGroupId: "" },
    ...requestContext(flags)
  });

  for (const group of groups) {
    const project = (group.projects ?? []).find((item) => item.tenantId === tenantId);
    if (project?.environment && group.tenantGroupId) {
      return { environment: project.environment, tenantGroupId: group.tenantGroupId };
    }
  }

  throw new Error(`Project '${tenantId}' was not found in Project/Gets.`);
}

async function resolveRepoId(
  tenantGroupId: string,
  environment: string,
  flags: Record<string, string | boolean>
): Promise<string> {
  const response = await blocksRequest<TenantAssetResponse>("/os/v4/Project/GetAsset", {
    accountAuth: true,
    query: { page: 0, pageSize: 100, tenantGroupId },
    ...requestContext(flags)
  });

  const resources = response.assets?.resources ?? [];
  if (resources.length === 0) {
    throw new CliActionableError(
      "No repo linked to this project.",
      "repo_not_linked",
      "Link a repo from the Blocks portal (requires GitHub auth), then re-run this command."
    );
  }

  const matched =
    resources.length === 1
      ? resources[0]
      : resources.find((resource) => resource.name?.toLowerCase() === environment.toLowerCase());

  if (!matched?.resourceId) {
    throw new CliActionableError(
      `Multiple repos are linked to this project and none is named for environment '${environment}'.`,
      "repo_ambiguous",
      "Check the repo links for this project from the Blocks portal."
    );
  }

  return matched.resourceId;
}

async function resolveRepoBranch(
  repoId: string,
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<{ branch: string; repoUrl: string }> {
  const result = await blocksRequest<RepoDetailsResponse>("/release/v4/api/Build/repo-details", {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: { RepoId: repoId },
    ...requestContext(flags)
  });

  const repo = result.data?.repo;
  if (!repo?.branch) {
    throw new CliActionableError(
      `Repo '${repoId}' from this project's linked asset was not found in blocks-release.`,
      "repo_not_found",
      "Check the repo link for this project from the Blocks portal."
    );
  }

  return { branch: repo.branch, repoUrl: repo.repoUrl ?? "" };
}
