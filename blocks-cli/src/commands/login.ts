import { parseFlags, stringFlag } from "../lib/args.js";
import { getImpersonatedProjectSession, pollDeviceToken, requestDeviceAuthorization } from "../lib/auth.js";
import { getAccountProfile, readConfig, writeConfig } from "../lib/config.js";
import { openBrowser } from "../lib/open-browser.js";
import { listProjectGroups } from "../lib/project-info.js";
import { applyAccountToken } from "../lib/token.js";
import { readTokenStore, writeTokenStore } from "../lib/token-store.js";
import { readWorkspaceConfig } from "../lib/workspace.js";

export async function login(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountOverride = stringFlag(flags, "account");
  const config = await readConfig();
  const { name, profile } = getAccountProfile(config, accountOverride);

  const device = await requestDeviceAuthorization(profile);
  console.log("Authorize this device:");
  console.log(`URL: ${device.verification_uri_complete ?? device.verification_uri}`);
  console.log(`Code: ${device.user_code}`);

  if (device.verification_uri_complete) {
    const opened = await openBrowser(device.verification_uri_complete);
    console.log(opened
      ? "Opened your browser to approve this device -- just confirm the code above."
      : "Browser auto-open is unavailable on this machine. Open the URL above manually.");
  } else {
    console.log("Open the URL above and enter the code to approve this device.");
  }

  console.log("Waiting for approval...");

  const token = await pollDeviceToken(profile, device, {
    onWait: (seconds) => console.log(`Checking for approval in ${seconds}s...`)
  });
  const latest = await readConfig();
  const latestStore = await readTokenStore();
  const next = applyAccountToken(latest, latestStore, name, profile.clientId, token);
  await writeConfig(next.config);
  await writeTokenStore(next.store);

  console.log("Login done.");

  const workspace = await readWorkspaceConfig();
  const rememberedTenantId = workspace.project?.tenantId ?? next.config.selectedProject?.tenantId;

  if (rememberedTenantId) {
    try {
      await getImpersonatedProjectSession(name, rememberedTenantId);
      console.log(`Re-selected project tenant ${rememberedTenantId}.`);
    } catch (error) {
      console.log(`Could not re-select project tenant ${rememberedTenantId}: ${error instanceof Error ? error.message : String(error)}`);
      console.log("Run 'blocks use <tenantId>' to select a project.");
    }
    return;
  }

  try {
    const groups = await listProjectGroups(flags);
    const projects = groups.flatMap((group) => group.projects ?? []);
    if (projects.length === 0) {
      console.log("No projects found for this account.");
      return;
    }

    console.log("Available projects:");
    for (const project of projects) {
      console.log(`  ${project.tenantId ?? "-"}  ${project.name ?? "-"}  ${project.environment ?? "-"}`);
    }
    console.log("Run 'blocks use <tenantId>' to select one.");
  } catch (error) {
    console.log(`Could not list projects: ${error instanceof Error ? error.message : String(error)}`);
  }
}
