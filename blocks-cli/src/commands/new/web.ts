import { parseFlags, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { defaults, readConfig, writeConfig } from "../../lib/config.js";
import { apiUrlFromAppDomain } from "../../lib/domains.js";
import { CliActionableError } from "../../lib/errors.js";
import { findProjectByTenantId, ProjectRecord } from "../../lib/project-info.js";
import { promptText, selectFromList } from "../../lib/prompt.js";
import { requestContext } from "../../lib/request-context.js";
import { scaffoldWebProject } from "../../lib/scaffold-web/index.js";
import { parseCommand, readWorkspaceConfig, selectedProject, writeWorkspaceConfig } from "../../lib/workspace.js";

export async function newWeb(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0];
  if (!name) throw new Error("Missing web app name.");

  const tenantId = stringFlag(flags, "x-blocks-key") || (await selectedProject(flags));
  const explicitAppDomain = stringFlag(flags, "app-domain");
  const project = explicitAppDomain ? {} : (await findProjectByTenantId(tenantId, flags)).project;

  const oidcUrl = stringFlag(flags, "oidc-url", { defaultValue: defaults().oidcUrl });
  const appDomain = await resolveAppDomain(project, flags);
  const apiUrl = stringFlag(flags, "blocks-api-url") || apiUrlFromAppDomain(appDomain);
  const oidcClientId = await resolveOidcClientId(tenantId, appDomain, name, flags);

  await scaffoldWebProject({
    apiUrl,
    appDomain,
    name,
    oidcClientId,
    oidcUrl,
    xBlocksKey: tenantId
  });

  try {
    const config = await readConfig();
    await writeConfig({
      ...config,
      selectedProject: {
        ...config.selectedProject,
        appDomain,
        name,
        tenantId
      }
    });
  } catch (error) {
    console.warn(`Warning: could not update global CLI project selection: ${(error as Error).message}`);
  }

  const workspace = await readWorkspaceConfig();
  if (Object.keys(workspace).length > 0) {
    await writeWorkspaceConfig({
      ...workspace,
      project: {
        ...workspace.project,
        apiUrl,
        appDomain,
        tenantId
      }
    });
  }

  console.log(`Created ${name}`);
  console.log(`Next: cd ${name} && npm install && npm run cert && npm run dev`);
  console.log("See README.md for hosts-file and OIDC redirect URI setup.");
}

async function resolveAppDomain(project: ProjectRecord, flags: Record<string, string | boolean>): Promise<string> {
  const flagValue = stringFlag(flags, "app-domain");
  const domains = (project.applications ?? [])
    .map((application) => application.domain)
    .filter((domain): domain is string => Boolean(domain));

  if (flagValue) {
    if (domains.length > 0 && !domains.includes(flagValue)) {
      console.warn(`Warning: '${flagValue}' is not one of this project's known domains (${domains.join(", ")}).`);
    }
    return flagValue;
  }

  if (domains.length === 0) {
    throw new CliActionableError(
      "This project has no domains registered in Blocks.",
      "no_project_domain",
      "Add a domain from the Blocks portal, or pass --app-domain explicitly."
    );
  }

  if (domains.length === 1) return domains[0];

  const index = await selectFromList("Multiple domains found for this project -- choose one:", domains);
  return domains[index];
}

type OidcClientSummary = { id: string; label: string };

async function resolveOidcClientId(
  tenantId: string,
  appDomain: string,
  appName: string,
  flags: Record<string, string | boolean>
): Promise<string | undefined> {
  const flagValue = stringFlag(flags, "client-id");
  if (flagValue) return flagValue;

  const clients = await listOidcClientSummaries(tenantId, flags);
  const options = [
    ...clients.map((client) => `${client.label} (${client.id})`),
    "Create a new OIDC client now",
    "Skip -- register later from the Blocks portal or 'auth:oidc-clients:save'"
  ];

  const choice = await selectFromList("Choose an OIDC client for this app's login, or create/skip:", options);

  if (choice < clients.length) return clients[choice].id;
  if (choice === clients.length) return await createOidcClientInteractively(tenantId, appDomain, appName, flags);

  console.warn(
    "Warning: no OIDC client selected. The scaffolded app's login page will show a setup notice until you register a public OIDC client (redirect_uri = <origin>/login/callback) and set VITE_BLOCKS_OIDC_CLIENT_ID in .env."
  );
  return undefined;
}

async function listOidcClientSummaries(tenantId: string, flags: Record<string, string | boolean>): Promise<OidcClientSummary[]> {
  const raw = await blocksRequest<unknown>("/iam/v4/oidc-clients", {
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });

  const summaries: OidcClientSummary[] = [];
  for (const item of normalizeList(raw)) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = record.itemId ?? record.clientId ?? record.id;
    if (typeof id !== "string" || !id) continue;

    const label = typeof record.clientDisplayName === "string" && record.clientDisplayName ? record.clientDisplayName : id;
    summaries.push({ id, label });
  }

  return summaries;
}

function normalizeList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const key of ["data", "items", "results"]) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

async function createOidcClientInteractively(
  tenantId: string,
  appDomain: string,
  appName: string,
  flags: Record<string, string | boolean>
): Promise<string> {
  const defaultRedirect = `https://${appDomain}/login/callback`;
  const displayName = (await promptText(`OIDC client display name [${appName}]: `)) || appName;
  const redirectUri = (await promptText(`Redirect URI [${defaultRedirect}]: `)) || defaultRedirect;

  const body = {
    clientDisplayName: displayName,
    isActive: true,
    redirectUris: [redirectUri],
    registerAsIdentityProvider: true,
    requirePkce: true,
    scope: "openid profile"
  };

  await confirmMutation(flags, `Create OIDC client '${displayName}' for this project. The response's client secret (if any) is shown once.`);
  const result = await blocksRequest<Record<string, unknown>>("/iam/v4/oidc-clients", {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });

  console.log("Created OIDC client:");
  console.log(JSON.stringify(result, null, 2));

  const id = result.itemId ?? result.clientId ?? result.id;
  if (typeof id !== "string" || !id) {
    throw new Error("OIDC client creation response did not include a recognizable client id (itemId/clientId/id). Check the JSON above and pass --client-id manually.");
  }

  return id;
}
