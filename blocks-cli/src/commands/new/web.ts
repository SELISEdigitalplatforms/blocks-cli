import { existsSync } from "node:fs";
import { join } from "node:path";
import { booleanFlag, optionalIntegerFlag, parseFlags, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { defaults } from "../../lib/config.js";
import { apiUrlFromAppDomain, oidcRedirectUrisFromAppDomain } from "../../lib/domains.js";
import { CliActionableError } from "../../lib/errors.js";
import { listOidcClients } from "../../lib/oidc-callback.js";
import { withBlocksIdentityProviderDiscovery } from "../../lib/oidc-discovery.js";
import { findAvailablePort, isPortFree } from "../../lib/port.js";
import { findProjectByTenantId, ProjectRecord } from "../../lib/project-info.js";
import { promptText, selectFromList } from "../../lib/prompt.js";
import { requestContext } from "../../lib/request-context.js";
import { writeOutput } from "../../lib/output.js";
import { scaffoldWebProject } from "../../lib/scaffold-web/index.js";
import { parseCommand, readWorkspaceConfig, saveSelectedProject, selectedProject, writeWorkspaceConfig } from "../../lib/workspace.js";

const DEFAULT_DEV_PORT = 5173;

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
  const devPort = await resolveDevPort(flags);

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(await planNewWeb({ apiUrl, appDomain, devPort, name, oidcUrl, tenantId }, flags), flags);
    return;
  }

  const oidcClientId = await resolveOidcClientId(tenantId, appDomain, name, devPort, flags);

  if (oidcClientId) {
    await ensureOidcLoginEnabled(tenantId, oidcUrl, flags);
  }

  await scaffoldWebProject({
    apiUrl,
    appDomain,
    devPort,
    name,
    oidcClientId,
    oidcUrl,
    xBlocksKey: tenantId
  });

  let selectionWarning: string | undefined;
  try {
    await saveSelectedProject(tenantId, stringFlag(flags, "account") || undefined, { appDomain, name });
  } catch (error) {
    selectionWarning = (error as Error).message;
    console.warn(`Warning: could not update account project selection: ${selectionWarning}`);
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

  if (flags.json) {
    writeOutput({
      apiUrl,
      appDomain,
      created: true,
      devPort,
      directory: name,
      name,
      next: [`cd ${name}`, "npm install", "npm run cert", "npm run dev"],
      oidcClientId: oidcClientId ?? null,
      oidcUrl,
      selectionWarning: selectionWarning ?? null,
      tenantId
    }, flags);
  } else {
    console.log(`Created ${name}`);
    console.log(`Next: cd ${name} && npm install && npm run cert && npm run dev`);
    console.log("See README.md for hosts-file and OIDC redirect URI setup.");
  }
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

// Default dev port (5173, Vite's own default) is the one baked into
// pre-existing docs/instructions and the redirect URI a developer may have
// already registered by hand, so it's only displaced when something else on
// the machine is already bound to it -- most commonly a second Blocks app
// scaffolded earlier and still running its own `npm run dev`.
async function resolveDevPort(flags: Record<string, string | boolean>): Promise<number> {
  const explicitPort = optionalIntegerFlag(flags, "dev-port");

  if (explicitPort !== undefined) {
    if (explicitPort < 1 || explicitPort > 65535) {
      throw new Error("--dev-port must be between 1 and 65535.");
    }
    if (!(await isPortFree(explicitPort))) {
      throw new CliActionableError(
        `Port ${explicitPort} is already in use.`,
        "dev_port_in_use",
        "Pass a different --dev-port, or stop whatever is currently listening on it."
      );
    }
    return explicitPort;
  }

  if (await isPortFree(DEFAULT_DEV_PORT)) return DEFAULT_DEV_PORT;

  const picked = await findAvailablePort(DEFAULT_DEV_PORT + 1);
  console.warn(
    `Warning: default dev port ${DEFAULT_DEV_PORT} is already in use (likely another Blocks app already running locally) -- using ${picked} instead. Pass --dev-port to choose explicitly.`
  );
  return picked;
}

type OidcClientSummary = { id: string; label: string };

async function resolveOidcClientId(
  tenantId: string,
  appDomain: string,
  appName: string,
  devPort: number,
  flags: Record<string, string | boolean>
): Promise<string | undefined> {
  const flagValue = stringFlag(flags, "client-id");
  if (flagValue) {
    await assertOidcClientExists(tenantId, flagValue, flags);
    return flagValue;
  }

  const clients = await listOidcClientSummaries(tenantId, flags);
  const options = [
    ...clients.map((client) => `${client.label} (${client.id})`),
    "Create a new OIDC client now",
    "Skip -- register later from the Blocks portal or 'auth:oidc-clients:save'"
  ];

  const choice = await selectFromList("Choose an OIDC client for this app's login, or create/skip:", options);

  if (choice < clients.length) return clients[choice].id;
  if (choice === clients.length) return await createOidcClientInteractively(tenantId, appDomain, appName, devPort, flags);

  console.warn(
    "Warning: no OIDC client selected. The scaffolded app's login page will show a setup notice until you register a public OIDC client (redirect_uri = <origin>/login/callback) and set VITE_BLOCKS_OIDC_CLIENT_ID in .env."
  );
  return undefined;
}

/**
 * Fails when `--client-id` names no OIDC client in this project. Without this a typo
 * or placeholder id was baked into `.env` and OIDC login was still switched on for the
 * tenant, leaving a login that could never work. If the client list itself cannot be
 * read, the id is used as given (with a warning) rather than blocking setup.
 */
async function assertOidcClientExists(tenantId: string, clientId: string, flags: Record<string, string | boolean>): Promise<void> {
  let clients: OidcClientSummary[];
  try {
    clients = await listOidcClientSummaries(tenantId, flags);
  } catch (error) {
    console.warn(`Warning: could not list this project's OIDC clients to check --client-id '${clientId}' (${(error as Error).message}). Using it as given.`);
    return;
  }
  if (clients.some((client) => client.id === clientId)) return;
  throw new CliActionableError(
    `OIDC client '${clientId}' does not exist in project '${tenantId}'.`,
    "oidc_client_not_found",
    clients.length
      ? `Pass one of: ${clients.map((client) => `${client.id} (${client.label})`).join(", ")} -- or omit --client-id to create one.`
      : "This project has no OIDC clients yet. Omit --client-id to create one, or register one with 'blocks auth oidc-clients save'."
  );
}

async function listOidcClientSummaries(tenantId: string, flags: Record<string, string | boolean>): Promise<OidcClientSummary[]> {
  const summaries: OidcClientSummary[] = [];
  for (const record of await listOidcClients(tenantId, flags)) {
    const id = record.clientId ?? record.itemId ?? record.id;
    if (typeof id !== "string" || !id) continue;

    const label = typeof record.clientDisplayName === "string" && record.clientDisplayName ? record.clientDisplayName : id;
    summaries.push({ id, label });
  }

  return summaries;
}

// Creating/selecting an OIDC client is not enough for the hosted login flow to
// work: AuthController separately gates the whole OIDC/IdP path behind
// isOidcEnabled on the tenant's auth config, off by default. Without this,
// scaffolded apps 404/error on login until someone flips it manually in the
// portal (IAM > Auth Config), so check-and-enable it here as part of setup.
// POST /auth/config replaces the whole config document rather than merging
// (confirmed against the portal's own save call, which always resends every
// field) -- sending just `{ isOidcEnabled: true }` would reset every other
// AuthController setting for this tenant, so the fetched config is spread
// back in full with only that one field overridden.
//
// Turning isOidcEnabled on isn't a single independent flag either: the
// activation-link flow keys off accountActivationPath, which has to point at
// the OIDC variant ("oidc/activate/") once OIDC is on, or activation emails
// break. accountActionBaseUrl (the host those links are built against) is
// this project's IAM host, `oidcUrl`: under OIDC the links land on IAM's
// hosted activation page. A stored value is not kept -- a fresh project's is
// its app domain, which serves nothing until this app is deployed, so the
// first user's activation link 404'd. (IAM pins it to its own host on save too.)
async function ensureOidcLoginEnabled(tenantId: string, oidcUrl: string, flags: Record<string, string | boolean>): Promise<void> {
  const config = await readAuthConfig(tenantId, flags);
  const body = oidcLoginConfig(config, oidcUrl);
  if (!body) return;

  await confirmMutation(flags, "Enable OIDC login on this project's AuthController configuration.");
  await blocksRequest<unknown>("/iam/v4/auth/config", {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });
}

function readAuthConfig(tenantId: string, flags: Record<string, string | boolean>): Promise<Record<string, unknown>> {
  return blocksRequest<Record<string, unknown>>("/iam/v4/auth/config", {
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });
}

/** The full auth config to save to switch OIDC login on, or undefined when it already is. */
function oidcLoginConfig(config: Record<string, unknown>, oidcUrl: string): Record<string, unknown> | undefined {
  if (config.isOidcEnabled) return undefined;
  return {
    ...config,
    accountActionBaseUrl: oidcUrl,
    accountActivationPath: "oidc/activate/",
    isOidcEnabled: true
  };
}

type NewWebPlanInput = {
  apiUrl: string;
  appDomain: string;
  devPort: number;
  name: string;
  oidcUrl: string;
  tenantId: string;
};

/**
 * `new web --dry-run`: reads only, and returns what a real run would do. It used to
 * fall straight through to the real run -- confirmMutation treated --dry-run as
 * approval -- so a "preview" scaffolded the app and switched OIDC login on for the
 * tenant. Nothing here writes a file, mutates the tenant, or prompts.
 */
async function planNewWeb(input: NewWebPlanInput, flags: Record<string, string | boolean>): Promise<Record<string, unknown>> {
  const { name, tenantId, oidcUrl } = input;
  const requestedClientId = stringFlag(flags, "client-id");
  if (requestedClientId) await assertOidcClientExists(tenantId, requestedClientId, flags);

  const config = await readAuthConfig(tenantId, flags);
  const enabledConfig = oidcLoginConfig(config, oidcUrl);
  const authConfigChanges = enabledConfig
    ? Object.fromEntries(
      ["isOidcEnabled", "accountActivationPath", "accountActionBaseUrl"]
        .filter((key) => enabledConfig[key] !== config[key])
        .map((key) => [key, { from: config[key] ?? null, to: enabledConfig[key] }])
    )
    : {};

  let oidcClient: Record<string, unknown>;
  if (requestedClientId) {
    oidcClient = { action: "use", clientId: requestedClientId };
  } else {
    const clients = await listOidcClientSummaries(tenantId, flags);
    oidcClient = {
      action: "prompt",
      note: "Without --client-id a real run asks to pick one of these, create a new public OIDC client, or skip.",
      existing: clients
    };
  }

  const directoryExists = existsSync(join(process.cwd(), name));
  return {
    dryRun: true,
    ...input,
    directory: name,
    directoryExists,
    oidcClient,
    authConfig: enabledConfig
      ? {
        action: "enable-oidc",
        appliesWhen: requestedClientId ? "always" : "an OIDC client is chosen or created",
        endpoint: "POST /iam/v4/auth/config",
        changes: authConfigChanges
      }
      : { action: "none", reason: "OIDC login is already enabled" },
    writes: [
      `${name}/ (web app scaffold${directoryExists ? "; directory already exists, files would be overwritten" : ""})`,
      "account project selection",
      ...(Object.keys(await readWorkspaceConfig()).length > 0 ? ["blocks.json project (apiUrl, appDomain, tenantId)"] : [])
    ]
  };
}

async function createOidcClientInteractively(
  tenantId: string,
  appDomain: string,
  appName: string,
  devPort: number,
  flags: Record<string, string | boolean>
): Promise<string> {
  const [defaultRedirect, localRedirect] = oidcRedirectUrisFromAppDomain(appDomain, devPort);
  const displayName = (await promptText(`OIDC client display name [${appName}]: `)) || appName;
  const redirectUri = (await promptText(`Production redirect URI [${defaultRedirect}]: `)) || defaultRedirect;

  // clientType drives IAM's tokenEndpointAuthMethod: omitting it stores this browser
  // app as confidential ("client_secret_post") and lets it request client_credentials.
  // The scaffold only ever produces a PKCE SPA, so it is always "public".
  // isAutoRedirect: the scaffolded login page's startLogin() already navigates
  // straight to the provider via window.location.assign -- without this flag IAM
  // shows an interstitial "continue" click on the hosted login page instead of
  // redirecting immediately, which is dead weight for a flow the SPA already drives.
  const body = withBlocksIdentityProviderDiscovery({
    clientDisplayName: displayName,
    clientType: "public",
    isActive: true,
    isAutoRedirect: true,
    redirectUris: [...new Set([redirectUri, localRedirect])],
    registerAsIdentityProvider: true,
    requirePkce: true,
    scope: "openid profile"
  }, stringFlag(flags, "oidc-url", { defaultValue: defaults().oidcUrl }), tenantId);

  await confirmMutation(flags, `Create OIDC client '${displayName}' for this project. The response's client secret (if any) is shown once.`);
  const result = await blocksRequest<Record<string, unknown>>("/iam/v4/oidc-clients", {
    body,
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });

  const log = flags.json ? console.error : console.log;
  log("Created OIDC client:");
  log(JSON.stringify(result, null, 2));

  const id = result.itemId ?? result.clientId ?? result.id;
  if (typeof id !== "string" || !id) {
    throw new Error("OIDC client creation response did not include a recognizable client id (itemId/clientId/id). Check the JSON above and pass --client-id manually.");
  }

  return id;
}
