import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { writeOutput } from "../../lib/output.js";
import { getProjectAssets, resolveSelectedProject } from "../../lib/project-info.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  RELEASE_API,
  firstNonEmptyString,
  repoIdOf,
  resolveRepoBySelector,
  waitForBuild
} from "../../lib/release.js";
import { commandContextArgs, requestContext } from "../../lib/request-context.js";
import { parseCommand } from "../../lib/workspace.js";
import { releaseSecretsSync } from "./secrets/sync.js";

type RepoDetailsResponse = {
  data?: {
    repo?: { branch?: string; repoUrl?: string };
  };
};

export async function releaseDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const domain = stringFlag(flags, "domain");
  const repoSelector = stringFlag(flags, "repo");
  const secretsFile = stringFlag(flags, "with-secrets");
  const dryRun = booleanFlag(flags, "dry-run");
  const wait = booleanFlag(flags, "wait");
  const follow = booleanFlag(flags, "follow");
  const pollIntervalSeconds = integerFlag(flags, "poll-interval", DEFAULT_POLL_INTERVAL_SECONDS);
  const timeoutSeconds = integerFlag(flags, "timeout", DEFAULT_WAIT_TIMEOUT_SECONDS);

  const { project, group, tenantId: projectKey } = await resolveSelectedProject(flags);
  const environment = project.environment;
  const tenantGroupId = group.tenantGroupId;
  if (!environment || !tenantGroupId) {
    throw new Error(`Project '${projectKey}' was not found in Project/Gets.`);
  }

  let repoId: string;
  let branch: string;
  let repoUrl: string;
  if (repoSelector) {
    const repo = await resolveRepoBySelector(repoSelector, projectKey, flags);
    const resolvedId = repoIdOf(repo);
    if (!resolvedId) throw new Error(`Repo '${repoSelector}' has no id in Build/repos-list.`);
    repoId = resolvedId;
    branch = repo.branch ?? "";
    repoUrl = repo.repoUrl ?? "";
    if (!branch) {
      const details = await resolveRepoBranch(repoId, projectKey, flags);
      branch = details.branch;
      repoUrl = repoUrl || details.repoUrl;
    }
  } else {
    repoId = await resolveRepoId(tenantGroupId, environment, flags);
    const details = await resolveRepoBranch(repoId, projectKey, flags);
    branch = details.branch;
    repoUrl = details.repoUrl;
  }

  if (branch.toLowerCase() !== environment.toLowerCase()) {
    throw new CliActionableError(
      `Connected repo's branch '${branch}' does not match this project's environment '${environment}'.`,
      "branch_environment_mismatch",
      `Point the linked repo at a branch named '${environment}', or relink the correct branch from the Blocks portal.`
    );
  }

  const steps = [
    ...(secretsFile ? ["release:secrets:sync"] : []),
    ...(domain ? ["release:domain:set"] : []),
    "release:build:manual",
    ...(wait || follow ? ["release:wait"] : [])
  ];

  if (dryRun) {
    writeOutput(
      {
        branch,
        domain: domain || undefined,
        dryRun: true,
        environment,
        projectKey,
        repoId,
        secretsFile: secretsFile || undefined,
        steps
      },
      flags
    );
    return;
  }

  const actions = [
    ...(secretsFile ? [`sync secrets from '${secretsFile}'`] : []),
    ...(domain ? [`set custom domain '${domain}'`] : []),
    `deploy '${environment}' (repo ${repoId}, branch ${branch})`
  ];
  await confirmMutation(flags, `${actions.join(", then ")}.`);

  const contextArgs = commandContextArgs(flags);
  if (secretsFile) {
    console.error("== release:secrets:sync ==");
    await releaseSecretsSync([
      "--repo-id",
      repoId,
      "--file",
      secretsFile,
      "--yes",
      ...contextArgs,
      ...(flags.json ? ["--json"] : [])
    ]);
  }

  if (domain) {
    console.error("== release:domain:set ==");
    await blocksRequest<unknown>(`${RELEASE_API}/Build/repo-update`, {
      body: {
        projectEnv: environment,
        repoWithDomains: [{ customDeploymentDomain: domain, repoId, repoUrl }]
      },
      impersonatedProjectAuth: true,
      projectTenantId: projectKey,
      ...requestContext(flags)
    });
  }

  const result = await blocksRequest<Record<string, unknown>>(`${RELEASE_API}/Build/manual`, {
    body: { repoId },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  if (!wait && !follow) {
    writeOutput(result, flags);
    return;
  }

  const buildId = extractBuildId(result);
  if (!buildId) {
    console.error(`Warning: could not find a buildId in the deploy response to wait on. Response: ${JSON.stringify(result)}`);
    writeOutput(result, flags);
    return;
  }

  const { build, status, verdict } = await waitForBuild(buildId, projectKey, flags, {
    followLogs: follow,
    pollIntervalSeconds,
    timeoutSeconds
  });
  writeOutput({ build, buildId, status, verdict }, flags);
}

function extractBuildId(result: Record<string, unknown>): string | undefined {
  const direct = firstNonEmptyString(result, ["buildId", "itemId", "id", "buildID"]);
  if (direct) return direct;
  const data = result.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return firstNonEmptyString(data as Record<string, unknown>, ["buildId", "itemId", "id", "buildID"]);
  }
  return undefined;
}

async function resolveRepoId(
  tenantGroupId: string,
  environment: string,
  flags: Record<string, string | boolean>
): Promise<string> {
  const response = await getProjectAssets(tenantGroupId, flags);

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
      "Pass --repo <name|id> to pick one, or check the repo links from the Blocks portal."
    );
  }

  return matched.resourceId;
}

async function resolveRepoBranch(
  repoId: string,
  projectKey: string,
  flags: Record<string, string | boolean>
): Promise<{ branch: string; repoUrl: string }> {
  const result = await blocksRequest<RepoDetailsResponse>(`${RELEASE_API}/Build/repo-details`, {
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
