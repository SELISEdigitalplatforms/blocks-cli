import { blocksRequest } from "../../lib/api.js";
import { stringFlag } from "../../lib/args.js";
import { defaults } from "../../lib/config.js";
import { findProjectByTenantId } from "../../lib/project-info.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

// Read-only: "I want to use the Blocks SDK in my app -- show me the client."
// Resolves this project's createBlocksClient() config and prints it, same
// values 'new web' scaffolds with. Never writes a file and never mutates
// anything -- if you want the SDK wired into a new app, use 'new web'.
export async function sdkClient(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);

  const tenantId = stringFlag(flags, "x-blocks-key") || (await selectedProject(flags));
  const apiUrl = stringFlag(flags, "blocks-api-url", { defaultValue: defaults().apiUrl });
  const oidcUrl = stringFlag(flags, "oidc-url", { defaultValue: defaults().oidcUrl });

  let appDomain = stringFlag(flags, "app-domain");
  let oidcClientId = stringFlag(flags, "client-id");
  const notes: string[] = [];

  if (!appDomain || !oidcClientId) {
    const { project } = await findProjectByTenantId(tenantId, flags);

    if (!appDomain) {
      const domains = (project.applications ?? [])
        .map((application) => application.domain)
        .filter((domain): domain is string => Boolean(domain));

      if (domains.length === 1) {
        appDomain = domains[0];
      } else if (domains.length > 1) {
        notes.push(`Multiple domains registered for this project (${domains.join(", ")}) -- pass --app-domain to pick one.`);
      } else {
        notes.push("This project has no domains registered in Blocks -- pass --app-domain explicitly.");
      }
    }

    if (!oidcClientId) {
      const clients = await listOidcClients(tenantId, flags);

      if (clients.length === 1) {
        oidcClientId = clients[0].id;
      } else if (clients.length > 1) {
        notes.push(`Multiple OIDC clients found (${clients.map((client) => `${client.label} [${client.id}]`).join(", ")}) -- pass --client-id to pick one.`);
      } else {
        notes.push("No OIDC client registered for this project -- create one ('auth:oidc-clients:save') and pass --client-id.");
      }
    }
  }

  if (flags.json) {
    writeOutput({ apiUrl, appDomain: appDomain || undefined, notes, oidcClientId: oidcClientId || undefined, oidcUrl, xBlocksKey: tenantId }, flags);
    return;
  }

  console.log("import { createBlocksClient } from \"@seliseblocks/client\";");
  console.log("");
  console.log("export const blocksClient = createBlocksClient({");
  console.log(`  apiUrl: "${apiUrl}",`);
  if (appDomain) console.log(`  appDomain: "${appDomain}",`);
  console.log("  oidc: {");
  console.log(`    clientId: "${oidcClientId || "<register a public OIDC client, see auth:oidc-clients:save>"}",`);
  console.log("    scope: \"openid profile\",");
  console.log(`    url: "${oidcUrl}"`);
  console.log("  },");
  console.log(`  xBlocksKey: "${tenantId}"`);
  console.log("});");

  for (const note of notes) console.log(`\n${note}`);
}

async function listOidcClients(tenantId: string, flags: Record<string, string | boolean>): Promise<Array<{ id: string; label: string }>> {
  const raw = await blocksRequest<unknown>("/iam/v4/oidc-clients", {
    impersonatedProjectAuth: true,
    projectTenantId: tenantId,
    ...requestContext(flags)
  });

  const clients: Array<{ id: string; label: string }> = [];
  for (const item of normalizeList(raw)) {
    if (typeof item !== "object" || item === null) continue;
    const record = item as Record<string, unknown>;
    const id = record.itemId ?? record.clientId ?? record.id;
    if (typeof id !== "string" || !id) continue;

    const label = typeof record.clientDisplayName === "string" && record.clientDisplayName ? record.clientDisplayName : id;
    clients.push({ id, label });
  }

  return clients;
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
