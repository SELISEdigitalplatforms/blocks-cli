import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { RELEASE_API, ReleaseEnvelope } from "../../../lib/release.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type HostingProviderRecord = {
  id?: string;
  name?: string;
  status?: string;
  region?: Array<{
    id?: string;
    name?: string;
    status?: string;
    machineSpecs?: Array<{ id?: string; ram?: string; cpu?: string; bandwidth?: string; status?: string }>;
  }>;
} & Record<string, unknown>;

/** Valid hosting providers, regions, and machine configs for 'release setup'. */
export async function releaseSettingsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<ReleaseEnvelope<HostingProviderRecord[]>>(`${RELEASE_API}/Build/settings`, {
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  const providers = Array.isArray(result?.data) ? result.data : [];
  writeOutput(
    {
      providers: providers.map((provider) => ({
        id: provider.id,
        name: provider.name,
        regions: (provider.region ?? []).map((region) => ({
          id: region.id,
          machineConfigs: (region.machineSpecs ?? []).map((spec) => ({
            bandwidth: spec.bandwidth,
            cpu: spec.cpu,
            id: spec.id,
            ram: spec.ram,
            status: spec.status
          })),
          name: region.name,
          status: region.status
        })),
        status: provider.status
      }))
    },
    flags
  );
}
