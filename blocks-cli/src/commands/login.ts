import { parseFlags, stringFlag } from "../lib/args.js";
import { getImpersonatedProjectSession, pollDeviceToken, requestDeviceAuthorization, storeAccountLogin } from "../lib/auth.js";
import { createAccountProfile, readConfig, resolveAccountProfile, writeConfig } from "../lib/config.js";
import { openBrowser } from "../lib/open-browser.js";
import { listProjectGroups } from "../lib/project-info.js";
import { readWorkspaceConfig } from "../lib/workspace.js";

export async function login(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const accountOverride = stringFlag(flags, "account").trim();
  let config = await readConfig();

  if (accountOverride && !config.accounts[accountOverride]) {
    config = {
      ...config,
      accounts: {
        ...config.accounts,
        [accountOverride]: createAccountProfile()
      }
    };
    await writeConfig(config);
  }

  const { name, profile } = await resolveAccountProfile(config, accountOverride || undefined);

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
  await storeAccountLogin(name, profile, token);
  const latest = await readConfig();

  console.log("Login done.");

  const workspace = await readWorkspaceConfig();
  const rememberedTenantId = workspace.project?.tenantId ?? latest.accounts[name]?.selectedProject?.tenantId;

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
