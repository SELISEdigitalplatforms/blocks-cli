import { authRefresh } from "./commands/auth/refresh.js";
import { authRemove } from "./commands/auth/remove.js";
import { authStatus } from "./commands/auth/status.js";
import { deselectProject } from "./commands/deselect.js";
import { doctor } from "./commands/doctor.js";
import { dataReload } from "./commands/data/reload.js";
import { dataValidate } from "./commands/data/validate.js";
import { dataRulesDeploy } from "./commands/data/rules/deploy.js";
import { dataRulesPull } from "./commands/data/rules/pull.js";
import { dataSchemaList } from "./commands/data/schema/list.js";
import { dataSchemaPull } from "./commands/data/schema/pull.js";
import { dataSchemaPush } from "./commands/data/schema/push.js";
import { iamMe } from "./commands/iam/me.js";
import { init } from "./commands/init.js";
import { localizationPull } from "./commands/localization/pull.js";
import { localizationPush } from "./commands/localization/push.js";
import { localizationValidate } from "./commands/localization/validate.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { newWeb } from "./commands/new/web.js";
import { createProject } from "./commands/projects/create.js";
import { getProject } from "./commands/projects/get.js";
import { listProjects } from "./commands/projects/list.js";
import { releaseBuildsGet } from "./commands/release/builds/get.js";
import { releaseBuildsList } from "./commands/release/builds/list.js";
import { releaseDeploy } from "./commands/release/deploy.js";
import { releaseStatus } from "./commands/release/status.js";
import { useProject } from "./commands/use.js";
import { CliActionableError } from "./lib/errors.js";

const [command, subcommand, ...rest] = process.argv.slice(2);

try {
  if (command === "--version" || command === "-v" || command === "version") {
    await printVersion();
  } else if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else if (command === "auth:remove" || (command === "auth" && subcommand === "remove")) {
    await authRemove(command === "auth" ? rest : [subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:status") {
    await authStatus([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:refresh") {
    await authRefresh([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth" && subcommand === "status") {
    await authStatus(rest);
  } else if (command === "auth" && subcommand === "refresh") {
    await authRefresh(rest);
  } else if (command === "doctor") {
    await doctor([subcommand, ...rest].filter(Boolean));
  } else if (command === "init") {
    await init();
  } else if (command === "login") {
    await login([subcommand, ...rest].filter(Boolean));
  } else if (command === "logout") {
    await logout([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:me" || (command === "iam" && subcommand === "me")) {
    await iamMe(command === "iam" ? rest : [subcommand, ...rest].filter(Boolean));
  } else if (command === "projects:list") {
    await listProjects([subcommand, ...rest].filter(Boolean));
  } else if (command === "projects" && subcommand === "list") {
    await listProjects(rest);
  } else if (command === "projects:create" || (command === "projects" && subcommand === "create")) {
    await createProject(command === "projects" ? rest : [subcommand, ...rest].filter(Boolean));
  } else if (command === "projects:get" || (command === "projects" && subcommand === "get")) {
    await getProject(command === "projects" ? rest : [subcommand, ...rest].filter(Boolean));
  } else if (command === "use") {
    await useProject([subcommand, ...rest].filter(Boolean));
  } else if (command === "deselect") {
    await deselectProject([subcommand, ...rest].filter(Boolean));
  } else if (command === "new" && subcommand === "web") {
    await newWeb(rest);
  } else if (command === "data:schema:list") {
    await dataSchemaList([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:pull") {
    await dataSchemaPull([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:push") {
    await dataSchemaPush([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:rules:pull") {
    await dataRulesPull([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:rules:deploy") {
    await dataRulesDeploy([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:reload") {
    await dataReload([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validate") {
    await dataValidate([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:validate") {
    await localizationValidate([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:push") {
    await localizationPush([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:pull") {
    await localizationPull([subcommand, ...rest].filter(Boolean));
  } else if (command === "release:deploy") {
    await releaseDeploy([subcommand, ...rest].filter(Boolean));
  } else if (command === "release:status") {
    await releaseStatus([subcommand, ...rest].filter(Boolean));
  } else if (command === "release:builds:list") {
    await releaseBuildsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "release:builds:get") {
    await releaseBuildsGet([subcommand, ...rest].filter(Boolean));
  } else {
    throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
  }
} catch (error) {
  const cliError = toCliError(error);
  if (process.argv.includes("--json")) {
    console.error(JSON.stringify(cliError, null, 2));
  } else {
    console.error(cliError.message);
    if (cliError.nextStep) console.error(`Next: ${cliError.nextStep}`);
  }
  process.exitCode = 1;
}

async function printVersion(): Promise<void> {
  const packageUrl = new URL("../package.json", import.meta.url);
  const pkg = JSON.parse(await (await import("node:fs/promises")).readFile(packageUrl, "utf8")) as { version?: string };
  console.log(pkg.version ?? "0.0.0");
}

function toCliError(error: unknown): { code: string; message: string; nextStep?: string } {
  if (error instanceof CliActionableError) {
    return { code: error.code, message: error.message, nextStep: error.nextStep };
  }

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("is not logged in") || message.includes("Run 'blocks-os login' first")) {
    return { code: "not_logged_in", message, nextStep: "blocks-os login" };
  }

  if (message.includes("token expired") || message.includes("refresh token") || message.includes("cannot decrypt")) {
    return { code: "auth_repair_required", message, nextStep: "blocks-os login" };
  }

  if (message.includes("No project selected")) {
    return { code: "project_not_selected", message, nextStep: "blocks-os use <tenantId>" };
  }

  if (message.startsWith("Blocks API 401") || message.startsWith("Blocks API 403")) {
    return { code: "api_auth_failed", message, nextStep: "blocks-os auth:status && blocks-os login" };
  }

  return { code: "command_failed", message };
}

function printHelp(): void {
  console.log(`Blocks OS CLI

Usage:
  blocks-os <command> [options]

Global options:
  --version                 Print CLI version.
  --json                    Print machine-readable JSON where supported.
  --api-url <url>           Override Blocks API URL for this command.
  --account <name>          Use a named account profile; default is implicit.
  --project <tenantId>      Use a project tenant for project-scoped commands.
  --dry-run                 Show planned mutation without calling the API.
  --yes                     Skip mutation confirmation after explicit approval.

Setup and health:
  blocks-os init
    Create local Blocks workspace files: blocks.json, data schema/rules folders,
    release deploy config, and .env.example.

  blocks-os doctor [--json]
    Check local Node.js, OIDC config, token cache, selected project, and config
    file locations. Does not mutate cloud resources.

Auth:
  blocks-os login
    Device-code login. Prints a verification URL and user code, opens the
    browser to the verification page when possible so you only need to click
    approve, then polls until the device is authorized; stores account access
    and refresh tokens and auto-refreshes later.

  blocks-os auth:status [--json]
    Show only whether account/project access and refresh tokens are missing,
    valid, expired, or available. Does not print account config values.

  blocks-os auth:refresh [--project] [--json]
    Force account token refresh, or project token refresh with --project.

  blocks-os auth:remove <account>
    Clear cached tokens and stored local credentials for that account. The
    packaged default OS account is restored from package defaults.

  blocks-os logout
    Revoke the current refresh token when possible and remove local session data.

Projects:
  blocks-os projects:list [--json]
    List accessible Blocks projects via /os/v4/Project/Gets using the account
    token. Read-only.

  blocks-os projects:get [tenantId] [--json]
    Read one project from Project/Gets. Uses selected project when tenantId is
    omitted. Read-only.

  blocks-os projects:create <name> [--env dev] [--yes] [--dry-run] [--json]
    Create a Blocks project/environment via /os/v4/Project/Create using the
    account token. Mutating; supports dry-run and confirmation.

  blocks-os use <project-tenant-id>
    Save the selected project tenant globally and in blocks.json when present.
    Does not call cloud APIs.

  blocks-os deselect
    Clear the selected project tenant (globally and in blocks.json) and drop
    its cached impersonation token. Use this to recover when an impersonated
    project token has expired or failed, then run 'blocks-os use <tenantId>'
    again to reselect and re-impersonate.

IAM:
  blocks-os iam:me [--json]
    Read the current user from IAM using the account token. This is the only IAM
    admin surface exposed in the MVP.

Data:
  blocks-os data:validate [--json]
    Validate local blocks/data/schemas/*.json and blocks/data/rules.json before
    pushing. Local-only.

  blocks-os data:schema:list [--json]
    List project schemas via /data/v4/schemas using an impersonated project
    token. Read-only.

  blocks-os data:schema:pull [--json]
    Download project schemas into blocks/data/schemas/*.json. Writes local files
    only.

  blocks-os data:schema:push [--dry-run] [--yes] [--json]
    Create or update project schemas via /data/v4/schemas/define. Mutating;
    uses POST for create and PUT for update.

  blocks-os data:rules:pull [--json]
    Download data-access policies into blocks/data/rules.json. Writes local
    files only.

  blocks-os data:rules:deploy [--dry-run] [--yes] [--json]
    Apply schema security and data-access policies. Mutating; supports dry-run
    and confirmation.

  blocks-os data:reload [--dry-run] [--yes] [--json]
    Reload Data schema configuration so staged schema/rule changes become live.
    Mutating; calls POST /data/v4/schema-configurations/reload.

Localization:
  blocks-os localization:validate --module <name> --language <culture> [--file <path>] [--json]
    Validate a local i18n JSON dictionary. Supports nested JSON input and
    validates the flattened key/value set locally.

  blocks-os localization:push --module <name> --language <culture> [--file <path>] [--route <route>] [--context <text>] [--dry-run] [--yes] [--json]
    Create or update Localization keys from a local i18n JSON dictionary via
    /localization/v4/Key/SaveKeys. Creates the module first when it is missing.

  blocks-os localization:pull --module <name> --language <culture> [--out <path>] [--json]
    Download published cloud localization via
    /localization/v4/Key/GetCloudUilmFile and write a local JSON dictionary.

Release:
  blocks-os release:deploy --repo-id <repoId> [--dry-run] [--yes] [--json]
    Trigger a manual Release build/deploy for a configured repository using an
    impersonated project token. Mutating; no artifact upload is performed by
    this CLI.

  blocks-os release:status <buildId> [--json]
    Read Release build status by build id using an impersonated project
    token. Read-only.

  blocks-os release:builds:list --repo-id <repoId> [--json]
    List Release build details for a repository using an impersonated project
    token. Read-only.

  blocks-os release:builds:get <buildId> [--json]
    Alias for release:status. Read-only.

Scaffold:
  blocks-os new web <name> --x-blocks-key <tenantId> --app-domain <domain> [--client-id <oidcClientId>]
                    [--blocks-api-url <url>] [--oidc-url <url>]
    Create a Vite React starter app with a real browser Authorization Code +
    PKCE login flow against Blocks IAM (login page, /login/callback handler,
    route guards), plus Data schema listing, Release build lookup, environment
    config, and safe .gitignore defaults.
    --blocks-api-url defaults to the OS API (os.seliseblocks.com) if omitted -
    pass the runtime Data/IAM/Localization gateway URL explicitly (typically
    https://api.seliseblocks.com) for the scaffolded app to work at runtime.
    --oidc-url defaults to https://iam.seliseblocks.com.
`);
}
