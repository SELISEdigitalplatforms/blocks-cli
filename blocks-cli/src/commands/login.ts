import { parseFlags, stringFlag } from "../lib/args.js";
import { getImpersonatedProjectSession, pollDeviceToken, requestDeviceAuthorization, storeAccountLogin } from "../lib/auth.js";
import { createAccountProfile, readConfig, resolveAccountProfile, writeConfig } from "../lib/config.js";
import { openBrowser } from "../lib/open-browser.js";
import { writeOutput } from "../lib/output.js";
import { listProjectGroups } from "../lib/project-info.js";
import { readWorkspaceConfig } from "../lib/workspace.js";

export async function login(argv: string[]): Promise<void> {
  const { flags } = parseFlags(argv);
  const progress = (message: string): void => flags.json ? console.error(message) : console.log(message);
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

  const device = await requestDeviceAuthorization(profile, name);
  progress("Authorize this device:");
  progress(`URL: ${device.verification_uri_complete ?? device.verification_uri}`);
  progress(`Code: ${device.user_code}`);

  if (device.verification_uri_complete) {
    const opened = await openBrowser(device.verification_uri_complete);
    progress(opened
      ? "Opened your browser to approve this device -- just confirm the code above."
      : "Browser auto-open is unavailable on this machine. Open the URL above manually.");
  } else {
    progress("Open the URL above and enter the code to approve this device.");
  }

  progress("Waiting for approval...");

  const token = await pollDeviceToken(profile, device, {
    accountName: name,
    onWait: (seconds) => progress(`Checking for approval in ${seconds}s...`)
  });
  await storeAccountLogin(name, profile, token);
  const latest = await readConfig();

  progress("Login done.");

  const workspace = await readWorkspaceConfig();
  const rememberedTenantId = workspace.project?.tenantId ?? latest.accounts[name]?.selectedProject?.tenantId;

  if (rememberedTenantId) {
    try {
      await getImpersonatedProjectSession(name, rememberedTenantId);
      progress(`Re-selected project tenant ${rememberedTenantId}.`);
      if (flags.json) writeOutput({ account: name, authenticated: true, projectReselected: true, tenantId: rememberedTenantId }, flags);
    } catch (error) {
      const projectError = error instanceof Error ? error.message : String(error);
      progress(`Could not re-select project tenant ${rememberedTenantId}: ${projectError}`);
      progress("Run 'blocks use <tenantId>' to select a project.");
      if (flags.json) writeOutput({ account: name, authenticated: true, projectError, projectReselected: false, tenantId: rememberedTenantId }, flags);
    }
    return;
  }

  try {
    const groups = await listProjectGroups(flags);
    const projects = groups.flatMap((group) => group.projects ?? []);
    if (projects.length === 0) {
      progress("No projects found for this account.");
      if (flags.json) writeOutput({ account: name, authenticated: true, projects: [] }, flags);
      return;
    }

    progress("Available projects:");
    for (const project of projects) {
      progress(`  ${project.tenantId ?? "-"}  ${project.name ?? "-"}  ${project.environment ?? "-"}`);
    }
    progress("Run 'blocks use <tenantId>' to select one.");
    if (flags.json) writeOutput({
      account: name,
      authenticated: true,
      projects: projects.map((project) => ({
        environment: project.environment ?? null,
        name: project.name ?? null,
        tenantId: project.tenantId ?? null
      }))
    }, flags);
  } catch (error) {
    const projectListError = error instanceof Error ? error.message : String(error);
    progress(`Could not list projects: ${projectListError}`);
    if (flags.json) writeOutput({ account: name, authenticated: true, projectListError, projects: null }, flags);
  }
}
