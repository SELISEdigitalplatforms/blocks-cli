import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { writeOutput } from "../../lib/output.js";
import { resolveSelectedProject } from "../../lib/project-info.js";
import {
  DEFAULT_POLL_INTERVAL_SECONDS,
  DEFAULT_WAIT_TIMEOUT_SECONDS,
  RELEASE_API,
  ReleaseEnvelope,
  firstNonEmptyString,
  repoIdOf,
  resolveRepoSelection,
  waitForBuild
} from "../../lib/release.js";
import { checkDeployedOidcCallback } from "../../lib/oidc-callback.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand } from "../../lib/workspace.js";

type SettingsProvider = {
  id?: string;
  name?: string;
  region?: Array<{
    id?: string;
    name?: string;
    machineSpecs?: Array<{ id?: string; ram?: string; cpu?: string }>;
  }>;
} & Record<string, unknown>;

/**
 * First-time deploy of a registered repo without the portal's Configure Deployment
 * modal: resolves the repo, resolves hosting provider / region / machine config by
 * name or id from Build/settings, then triggers Build/run-build (which creates the
 * namespace and GitHub webhook server-side). Re-deploys of an already-configured repo
 * belong to 'release deploy' (Build/manual), which reuses the stored settings.
 */
export async function releaseSetup(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const selector = args[0] || stringFlag(flags, "repo-id") || stringFlag(flags, "repo") || undefined;
  const providerSelector = stringFlag(flags, "hosting-provider");
  const regionSelector = stringFlag(flags, "region");
  const machineSelector = stringFlag(flags, "machine-config");
  const dryRun = booleanFlag(flags, "dry-run");
  const wait = booleanFlag(flags, "wait");
  const follow = booleanFlag(flags, "follow");
  const registerCallback = booleanFlag(flags, "register-callback");

  const { project, tenantId: projectKey } = await resolveSelectedProject(flags);
  const environment = project.environment;
  if (!environment) throw new Error(`Project '${projectKey}' has no environment in Project/Gets.`);

  const repo = await resolveRepoSelection(selector, projectKey, flags);
  const repoId = repoIdOf(repo);
  if (!repoId) throw new Error("The resolved repo is missing an id in Build/repos-list.");

  if (repo.branch && repo.branch.toLowerCase() !== environment.toLowerCase()) {
    throw new CliActionableError(
      `Repo '${repo.repoName ?? repoId}' is linked to branch '${repo.branch}', which does not match this project's environment '${environment}'.`,
      "branch_environment_mismatch",
      `Point the linked repo at a branch named '${environment}', or relink the correct branch from the Blocks portal.`
    );
  }

  const hosting = await resolveHostingSettings(projectKey, flags, providerSelector, regionSelector, machineSelector);

  const plan = {
    environment,
    hostingProviderId: hosting.hostingProviderId,
    machineConfigId: hosting.machineConfigId,
    projectKey,
    regionId: hosting.regionId,
    repoId,
    repoName: repo.repoName,
    steps: ["release:build:run-build", ...(wait || follow ? ["release:wait"] : [])]
  };

  if (dryRun) {
    writeOutput({ ...plan, dryRun: true }, flags);
    return;
  }

  await confirmMutation(
    flags,
    `First-time deploy of repo '${repo.repoName ?? repoId}' to '${environment}'${hosting.description}. This creates the deployment namespace and the push webhook.`
  );

  const result = await blocksRequest<Record<string, unknown>>(`${RELEASE_API}/Build/run-build`, {
    body: {
      hostingProviderId: hosting.hostingProviderId,
      machineConfigId: hosting.machineConfigId,
      regionId: hosting.regionId,
      repoId
    },
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  // run-build assigns the deployment's random-suffixed ingress URL; without --wait it
  // may not be visible in repos-list yet, in which case the check quietly finds no URL
  // (re-run 'release deploy' or the printed save command later).
  const verifyCallback = () => checkDeployedOidcCallback(repoId, projectKey, flags, { register: registerCallback });

  if (!wait && !follow) {
    await verifyCallback();
    writeOutput(result, flags);
    return;
  }

  const buildId =
    firstNonEmptyString(result, ["buildId", "itemId", "id", "buildID"]) ??
    (result.data && typeof result.data === "object" && !Array.isArray(result.data)
      ? firstNonEmptyString(result.data as Record<string, unknown>, ["buildId", "itemId", "id", "buildID"])
      : undefined);
  if (!buildId) {
    console.error(`Warning: could not find a buildId in the run-build response to wait on. Response: ${JSON.stringify(result)}`);
    writeOutput(result, flags);
    return;
  }

  const { build, status, verdict } = await waitForBuild(buildId, projectKey, flags, {
    followLogs: follow,
    pollIntervalSeconds: integerFlag(flags, "poll-interval", DEFAULT_POLL_INTERVAL_SECONDS),
    timeoutSeconds: integerFlag(flags, "timeout", DEFAULT_WAIT_TIMEOUT_SECONDS)
  });
  await verifyCallback();
  writeOutput({ build, buildId, status, verdict }, flags);
}

async function resolveHostingSettings(
  projectKey: string,
  flags: Record<string, string | boolean>,
  providerSelector: string,
  regionSelector: string,
  machineSelector: string
): Promise<{ description: string; hostingProviderId?: string; machineConfigId?: string; regionId?: string }> {
  // The three settings are optional server-side (RepoBuildRequest fields are nullable),
  // so only resolve names against Build/settings when at least one was passed.
  if (!providerSelector && !regionSelector && !machineSelector) {
    return { description: " with default hosting settings" };
  }

  const result = await blocksRequest<ReleaseEnvelope<SettingsProvider[]>>(`${RELEASE_API}/Build/settings`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  const providers = Array.isArray(result?.data) ? result.data : [];

  const provider = providerSelector
    ? pick(providers, providerSelector, "hosting provider", "hosting_provider_not_found", "blocks release settings list")
    : providers[0];
  const regions = provider?.region ?? [];
  const region = regionSelector
    ? pick(regions, regionSelector, "region", "region_not_found", "blocks release settings list")
    : regions[0];
  const machines = region?.machineSpecs ?? [];
  const machine = machineSelector
    ? pick(
        machines.map((spec) => ({ ...spec, name: spec.ram && spec.cpu ? `${spec.cpu}/${spec.ram}` : undefined })),
        machineSelector,
        "machine config",
        "machine_config_not_found",
        "blocks release settings list"
      )
    : machines[0];

  const parts = [provider?.name, region?.name].filter(Boolean).join(" / ");
  return {
    description: parts ? ` on ${parts}` : "",
    hostingProviderId: provider?.id,
    machineConfigId: machine?.id,
    regionId: region?.id
  };
}

function pick<T extends { id?: string; name?: string }>(
  items: T[],
  selector: string,
  label: string,
  code: string,
  nextStep: string
): T {
  const wanted = selector.toLowerCase();
  const match = items.find((item) => item.id?.toLowerCase() === wanted || item.name?.toLowerCase() === wanted);
  if (match) return match;
  const available = items.map((item) => `${item.name ?? "(unnamed)"} (${item.id ?? "?"})`).join(", ") || "(none)";
  throw new CliActionableError(`No ${label} matches '${selector}'. Available: ${available}.`, code, nextStep);
}
