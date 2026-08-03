import { parseFlags, stringFlag } from "../../lib/args.js";
import { defaults, readConfig, writeConfig } from "../../lib/config.js";
import { scaffoldWebProject } from "../../lib/scaffold-web/index.js";
import { readWorkspaceConfig, writeWorkspaceConfig } from "../../lib/workspace.js";

export async function newWeb(argv: string[]): Promise<void> {
  const parsed = parseFlags(argv);
  const name = parsed.args[0];
  if (!name) throw new Error("Missing web app name.");

  const appDomain = stringFlag(parsed.flags, "app-domain", { required: true });
  const apiUrl = stringFlag(parsed.flags, "blocks-api-url", { defaultValue: defaults().apiUrl });
  const oidcUrl = stringFlag(parsed.flags, "oidc-url", { defaultValue: defaults().oidcUrl });
  const xBlocksKey = stringFlag(parsed.flags, "x-blocks-key", { required: true });
  const oidcClientId = stringFlag(parsed.flags, "client-id");

  if (!oidcClientId) {
    console.warn("Warning: no --client-id given. The scaffolded app's login page will show a setup notice until you register a public OIDC client (redirect_uri = <origin>/login/callback) and set VITE_BLOCKS_OIDC_CLIENT_ID in .env.");
  }

  await scaffoldWebProject({
    apiUrl,
    appDomain,
    name,
    oidcClientId,
    oidcUrl,
    xBlocksKey
  });

  try {
    const config = await readConfig();
    await writeConfig({
      ...config,
      selectedProject: {
        ...config.selectedProject,
        appDomain,
        name,
        tenantId: xBlocksKey
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
        tenantId: xBlocksKey
      }
    });
  }

  console.log(`Created ${name}`);
  console.log(`Next: cd ${name} && npm install && npm run cert && npm run dev`);
  console.log("See README.md for hosts-file and OIDC redirect URI setup.");
}
