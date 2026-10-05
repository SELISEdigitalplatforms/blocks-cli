import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { readRepoBinding } from "../../lib/git.js";
import { writeOutput } from "../../lib/output.js";
import { getProjectAssets, resolveSelectedProject } from "../../lib/project-info.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  RELEASE_API,
  ReleaseRepo,
  firstNonEmptyString,
  listReleaseRepos,
  repoIdOf,
  resolveRepoBySelector,
  waitForBuild
} from "../../lib/release.js";
import { requestContext } from "../../lib/request-context.js";
import { checkDeployedOidcCallback } from "../../lib/oidc-callback.js";
import { parseCommand } from "../../lib/workspace.js";
import { SecretsSyncResult, syncSecretsFromFile } from "../../lib/release-secrets.js";

type RepoDetailsResponse = {
  data?: {
    repo?: { branch?: string; repoUrl?: string };
  };
};

export type RepoSource = "explicit" | "workspace-binding" | "repos-list-match" | "project-asset";

type ResolvedDeployRepo = {
  branch: string;
  repoId: string;
  repoLabel: string;
  repoSource: RepoSource;
  repoUrl: string;
};

export async function releaseDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const domain = stringFlag(flags, "domain");
  const repoSelector = stringFlag(flags, "repo");
  const secretsFile = stringFlag(flags, "with-secrets");
  const dryRun = booleanFlag(flags, "dry-run");
  const registerCallback = booleanFlag(flags, "register-callback");
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

  const resolved = await resolveDeployRepo({
    environment,
    flags,
    projectKey,
    repoSelector: repoSelector || undefined,
    tenantGroupId
  });
  const { repoId, branch, repoUrl, repoSource, repoLabel } = resolved;

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
        repoLabel,
        repoSource,
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
    repoSource === "explicit"
      ? `deploy '${environment}' (repo ${repoLabel}, branch ${branch})`
      : `deploy '${environment}' using repo ${repoLabel} (resolved from ${repoSourceLabel(repoSource)}), branch ${branch}`
  ];
  await confirmMutation(flags, `${actions.join(", then ")}.`);

  // Already confirmed above as part of this deploy, so the step runs unprompted. Its
  // summary (key names and counts only) rides along in the final document rather than
  // being printed here, keeping --json stdout to exactly one document.
  let secretsSync: SecretsSyncResult | undefined;
  if (secretsFile) {
    console.error("== release:secrets:sync ==");
    secretsSync = await syncSecretsFromFile({ file: secretsFile, flags, projectKey, repoId });
    console.error(
      `secrets: added ${secretsSync.added.length}, updated ${secretsSync.updated.length}, removed ${secretsSync.removed.length}${secretsSync.upToDate ? " (already up to date)" : ""}`
    );
  }
  const withSecrets = <T extends Record<string, unknown>>(document: T): T =>
    secretsSync ? { ...document, secretsSync } : document;

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

  // The deployed URL exists as soon as the repo record has one; a failed or still-running
  // build does not un-register a callback, so the check runs on every non-dry deploy.
  await checkDeployedOidcCallback(repoId, projectKey, flags, { register: registerCallback });

  if (!wait && !follow) {
    writeOutput(withSecrets({ ...result, repoSource }), flags);
    return;
  }

  const buildId = extractBuildId(result);
  if (!buildId) {
    console.error(`Warning: could not find a buildId in the deploy response to wait on. Response: ${JSON.stringify(result)}`);
    writeOutput(withSecrets({ ...result, repoSource }), flags);
    return;
  }

  const { build, status, verdict } = await waitForBuild(buildId, projectKey, flags, {
    followLogs: follow,
    pollIntervalSeconds,
    timeoutSeconds
  });
  writeOutput(withSecrets({ build, buildId, repoSource, status, verdict }), flags);
}

function repoSourceLabel(source: RepoSource): string {
  switch (source) {
    case "workspace-binding":
      return "this workspace's connected repository";
    case "repos-list-match":
      return "the single registered repo matching this environment";
    case "project-asset":
      return "this project's linked portal asset";
    default:
      return source;
  }
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

async function resolveDeployRepo(args: {
  environment: string;
  flags: Record<string, string | boolean>;
  projectKey: string;
  repoSelector?: string;
  tenantGroupId: string;
}): Promise<ResolvedDeployRepo> {
  const { environment, flags, projectKey, repoSelector, tenantGroupId } = args;

  if (repoSelector) {
    const repo = await resolveRepoBySelector(repoSelector, projectKey, flags);
    const resolvedId = repoIdOf(repo);
    if (!resolvedId) throw new Error(`Repo '${repoSelector}' has no id in Build/repos-list.`);
    let branch = repo.branch ?? "";
    let repoUrl = repo.repoUrl ?? "";
    if (!branch) {
      const details = await resolveRepoBranch(resolvedId, projectKey, flags);
      branch = details.branch;
      repoUrl = repoUrl || details.repoUrl;
    }
    return {
      branch,
      repoId: resolvedId,
      repoLabel: repo.repoName ?? repoSelector,
      repoSource: "explicit",
      repoUrl
    };
  }

  const repos = await listReleaseRepos(projectKey, flags);
  const binding = await readRepoBinding();
  if (binding) {
    const matched = repos.filter(
      (repo) => repoMatchesBinding(repo, binding.fullName) && (repo.branch ?? "").toLowerCase() === environment.toLowerCase()
    );
    if (matched.length === 1) {
      const repo = matched[0];
      const repoId = repoIdOf(repo);
      if (!repoId) throw new Error(`Repo '${binding.fullName}' has no id in Build/repos-list.`);
      return {
        branch: repo.branch ?? environment,
        repoId,
        repoLabel: repo.repoName ?? binding.fullName,
        repoSource: "workspace-binding",
        repoUrl: repo.repoUrl ?? binding.url
      };
    }
  }

  const envMatches = repos.filter((repo) => (repo.branch ?? "").toLowerCase() === environment.toLowerCase());
  if (envMatches.length === 1) {
    const repo = envMatches[0];
    const repoId = repoIdOf(repo);
    if (!repoId) throw new Error("Matched repo has no id in Build/repos-list.");
    return {
      branch: repo.branch ?? environment,
      repoId,
      repoLabel: repo.repoName ?? repoId,
      repoSource: "repos-list-match",
      repoUrl: repo.repoUrl ?? ""
    };
  }
  if (envMatches.length > 1 && !binding) {
    throw new CliActionableError(
      `Multiple repos match environment '${environment}' and none is the workspace's bound repo.`,
      "repo_ambiguous",
      "Pass --repo <name|id> to pick one."
    );
  }
  if (envMatches.length > 1 && binding) {
    throw new CliActionableError(
      `Multiple repos match environment '${environment}' and none is the workspace's bound repo.`,
      "repo_ambiguous",
      "Pass --repo <name|id> to pick one."
    );
  }

  const assetRepoId = await resolveRepoIdFromProjectAsset(tenantGroupId, environment, flags);
  if (assetRepoId) {
    const details = await resolveRepoBranch(assetRepoId, projectKey, flags);
    return {
      branch: details.branch,
      repoId: assetRepoId,
      repoLabel: details.repoUrl || assetRepoId,
      repoSource: "project-asset",
      repoUrl: details.repoUrl
    };
  }

  throw new CliActionableError(
    "No repo linked to this project.",
    "repo_not_linked",
    "Run 'blocks git init' or 'blocks git connect' to bind a repo, or pass --repo <owner/name>."
  );
}

function repoMatchesBinding(repo: ReleaseRepo, fullName: string): boolean {
  const wanted = fullName.toLowerCase();
  const name = (repo.repoName ?? "").toLowerCase();
  const url = (repo.repoUrl ?? "").toLowerCase();
  if (name === wanted) return true;
  if (url.includes(wanted)) return true;
  if (name.endsWith(`/${wanted.split("/").pop()}`) && wanted.includes("/")) {
    // repoName sometimes is short name only; compare tail
  }
  const short = wanted.split("/").pop() ?? wanted;
  if (name === short && (url.includes(wanted) || url.includes(`/${short}`))) return true;
  return false;
}

async function resolveRepoIdFromProjectAsset(
  tenantGroupId: string,
  environment: string,
  flags: Record<string, string | boolean>
): Promise<string | undefined> {
  const response = await getProjectAssets(tenantGroupId, flags);
  const resources = response.assets?.resources ?? [];
  if (resources.length === 0) return undefined;

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
