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
import { authClientCredentialsDelete } from "./commands/auth/client-credentials/delete.js";
import { authClientCredentialsList } from "./commands/auth/client-credentials/list.js";
import { authClientCredentialsSave } from "./commands/auth/client-credentials/save.js";
import { authConfigGet } from "./commands/auth/config/get.js";
import { authConfigSave } from "./commands/auth/config/save.js";
import { authIdpCreate } from "./commands/auth/idp/create.js";
import { authIdpDelete } from "./commands/auth/idp/delete.js";
import { authIdpGet } from "./commands/auth/idp/get.js";
import { authIdpList } from "./commands/auth/idp/list.js";
import { authIdpStatus } from "./commands/auth/idp/status.js";
import { authIdpUpdate } from "./commands/auth/idp/update.js";
import { authOidcClientsDelete } from "./commands/auth/oidc-clients/delete.js";
import { authOidcClientsGet } from "./commands/auth/oidc-clients/get.js";
import { authOidcClientsList } from "./commands/auth/oidc-clients/list.js";
import { authOidcClientsRotateSecret } from "./commands/auth/oidc-clients/rotate-secret.js";
import { authOidcClientsSave } from "./commands/auth/oidc-clients/save.js";
import { iamEmailAvailable } from "./commands/iam/email/available.js";
import { iamOrganizationsConfigGet } from "./commands/iam/organizations/config-get.js";
import { iamOrganizationsConfigSave } from "./commands/iam/organizations/config-save.js";
import { iamOrganizationsCreate } from "./commands/iam/organizations/create.js";
import { iamOrganizationsGet } from "./commands/iam/organizations/get.js";
import { iamOrganizationsList } from "./commands/iam/organizations/list.js";
import { iamOrganizationsMy } from "./commands/iam/organizations/my.js";
import { iamOrganizationsUpdate } from "./commands/iam/organizations/update.js";
import { iamPermissionsBySeverity } from "./commands/iam/permissions/by-severity.js";
import { iamPermissionsCreate } from "./commands/iam/permissions/create.js";
import { iamPermissionsGet } from "./commands/iam/permissions/get.js";
import { iamPermissionsList } from "./commands/iam/permissions/list.js";
import { iamPermissionsUpdate } from "./commands/iam/permissions/update.js";
import { iamResourcesFeatures } from "./commands/iam/resources/features.js";
import { iamResourcesGroups } from "./commands/iam/resources/groups.js";
import { iamRolesAssignPermissions } from "./commands/iam/roles/assign-permissions.js";
import { iamRolesAssignable } from "./commands/iam/roles/assignable.js";
import { iamRolesCreate } from "./commands/iam/roles/create.js";
import { iamRolesGet } from "./commands/iam/roles/get.js";
import { iamRolesList } from "./commands/iam/roles/list.js";
import { iamRolesUpdate } from "./commands/iam/roles/update.js";
import { iamSignupSettingsGet } from "./commands/iam/signup-settings/get.js";
import { iamSignupSettingsSave } from "./commands/iam/signup-settings/save.js";
import { iamUsersAccessGrant } from "./commands/iam/users/access-grant.js";
import { iamUsersAccessRevoke } from "./commands/iam/users/access-revoke.js";
import { iamUsersActivate } from "./commands/iam/users/activate.js";
import { iamUsersCreate } from "./commands/iam/users/create.js";
import { iamUsersDeactivate } from "./commands/iam/users/deactivate.js";
import { iamUsersExists } from "./commands/iam/users/exists.js";
import { iamUsersGet } from "./commands/iam/users/get.js";
import { iamUsersList } from "./commands/iam/users/list.js";
import { iamUsersUpdate } from "./commands/iam/users/update.js";
import { mfaBackupCodesGenerate } from "./commands/mfa/backup-codes/generate.js";
import { mfaBackupCodesList } from "./commands/mfa/backup-codes/list.js";
import { mfaBackupCodesUse } from "./commands/mfa/backup-codes/use.js";
import { mfaConfigGet } from "./commands/mfa/config-get.js";
import { mfaConfigSave } from "./commands/mfa/config-save.js";
import { mfaDisable } from "./commands/mfa/disable.js";
import { mfaGenerate } from "./commands/mfa/generate.js";
import { mfaMethodSet } from "./commands/mfa/method-set.js";
import { mfaResend } from "./commands/mfa/resend.js";
import { mfaTotpSetup } from "./commands/mfa/totp-setup.js";
import { mfaTotpVerifySetup } from "./commands/mfa/totp-verify-setup.js";
import { mfaVerify } from "./commands/mfa/verify.js";
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
  } else if (command === "iam:users:list") {
    await iamUsersList([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:get") {
    await iamUsersGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:create") {
    await iamUsersCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:update") {
    await iamUsersUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:activate") {
    await iamUsersActivate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:deactivate") {
    await iamUsersDeactivate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:access:grant") {
    await iamUsersAccessGrant([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:access:revoke") {
    await iamUsersAccessRevoke([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:users:exists") {
    await iamUsersExists([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:email:available") {
    await iamEmailAvailable([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:list") {
    await iamRolesList([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:get") {
    await iamRolesGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:create") {
    await iamRolesCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:update") {
    await iamRolesUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:assign-permissions") {
    await iamRolesAssignPermissions([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:roles:assignable") {
    await iamRolesAssignable([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:permissions:list") {
    await iamPermissionsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:permissions:get") {
    await iamPermissionsGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:permissions:create") {
    await iamPermissionsCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:permissions:update") {
    await iamPermissionsUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:permissions:by-severity") {
    await iamPermissionsBySeverity([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:resources:groups") {
    await iamResourcesGroups([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:resources:features") {
    await iamResourcesFeatures([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:list") {
    await iamOrganizationsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:get") {
    await iamOrganizationsGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:create") {
    await iamOrganizationsCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:update") {
    await iamOrganizationsUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:my") {
    await iamOrganizationsMy([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:config:get") {
    await iamOrganizationsConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:organizations:config:save") {
    await iamOrganizationsConfigSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:signup-settings:get") {
    await iamSignupSettingsGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "iam:signup-settings:save") {
    await iamSignupSettingsSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:config:get") {
    await mfaConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:config:save") {
    await mfaConfigSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:totp:setup") {
    await mfaTotpSetup([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:totp:verify-setup") {
    await mfaTotpVerifySetup([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:generate") {
    await mfaGenerate([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:resend") {
    await mfaResend([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:verify") {
    await mfaVerify([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:method:set") {
    await mfaMethodSet([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:disable") {
    await mfaDisable([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:backup-codes:list") {
    await mfaBackupCodesList([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:backup-codes:generate") {
    await mfaBackupCodesGenerate([subcommand, ...rest].filter(Boolean));
  } else if (command === "mfa:backup-codes:use") {
    await mfaBackupCodesUse([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:list") {
    await authIdpList([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:get") {
    await authIdpGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:create") {
    await authIdpCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:update") {
    await authIdpUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:delete") {
    await authIdpDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:idp:status") {
    await authIdpStatus([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:config:get") {
    await authConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:config:save") {
    await authConfigSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:client-credentials:list") {
    await authClientCredentialsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:client-credentials:save") {
    await authClientCredentialsSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:client-credentials:delete") {
    await authClientCredentialsDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:oidc-clients:list") {
    await authOidcClientsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:oidc-clients:get") {
    await authOidcClientsGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:oidc-clients:save") {
    await authOidcClientsSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:oidc-clients:delete") {
    await authOidcClientsDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "auth:oidc-clients:rotate-secret") {
    await authOidcClientsRotateSecret([subcommand, ...rest].filter(Boolean));
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
    Read the current user from IAM using the account token (bootstrapping/CLI
    operator identity, not a project resource). Every other iam:* command below
    is project-scoped: it requires a selected project and calls IAM using an
    impersonated project token only, never the account token.

  Users (/iam/v4/iam/users*):
    blocks-os iam:users:list [--page 1] [--page-size 20] [--email <e>] [--name <n>]
                              [--organization-id <id>] [--sort-by <field>] [--sort-desc]
                              [--filter '<json>'] [--json]
      Query users. --filter merges a raw JSON filter object over the convenience flags.
    blocks-os iam:users:get <id> [--organization-id <id>] [--json]
    blocks-os iam:users:create --email <e>|--user-name <n> [--first-name] [--last-name]
                                [--password] [--phone-number] [--organization-id]
                                [--roles a,b] [--permissions a,b] [--body '<json>'|--file <path>]
                                [--dry-run] [--yes] [--json]
    blocks-os iam:users:update <id> [--first-name] [--last-name] [--phone-number]
                                [--organization-id] [--roles a,b] [--permissions a,b]
                                [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os iam:users:activate <userId> [--reason <text>] [--dry-run] [--yes] [--json]
    blocks-os iam:users:deactivate <userId> [--dry-run] [--yes] [--json]
    blocks-os iam:users:access:grant <userId> [--roles a,b] [--permissions a,b]
                                [--organization-id] [--dry-run] [--yes] [--json]
    blocks-os iam:users:access:revoke <userId> [--organization-id] [--dry-run] [--yes] [--json]
    blocks-os iam:users:exists <email> [--json]
    blocks-os iam:email:available <email> [--json]

  Roles (/iam/v4/iam/roles*):
    blocks-os iam:roles:list [--page] [--page-size] [--search] [--slugs a,b]
                              [--organization-id] [--filter '<json>'] [--json]
    blocks-os iam:roles:get <id> [--json]
    blocks-os iam:roles:create --name <n> [--slug] [--description] [--parent-role-slug]
                              [--can-create-own] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks-os iam:roles:update <itemId> [--name] [--description] [--parent-role-slug]
                              [--propagate-to-other-org] [--can-create-own]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os iam:roles:assign-permissions <slug> [--add-permissions a,b]
                              [--remove-permissions a,b] [--organization-id]
                              [--dry-run] [--yes] [--json]
    blocks-os iam:roles:assignable [--json]

  Permissions (/iam/v4/iam/permissions*):
    blocks-os iam:permissions:list [--page] [--page-size] [--search] [--type <0-3>]
                              [--severity <0-4>] [--resource-group] [--tags a,b]
                              [--resources a,b] [--is-built-in] [--is-archived]
                              [--roles a,b] [--organization-id] [--filter '<json>'] [--json]
    blocks-os iam:permissions:get <id> [--json]
    blocks-os iam:permissions:create --name <n> [--type] [--description] [--resource]
                              [--resource-group] [--tags a,b] [--severity] [--is-built-in]
                              [--dependent-permissions a,b] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks-os iam:permissions:update <id> [same flags as create, plus --is-archived]
                              [--dry-run] [--yes] [--json]
    blocks-os iam:permissions:by-severity [--json]

  Resources (/iam/v4/iam/resource*):
    blocks-os iam:resources:groups [--json]
    blocks-os iam:resources:features [--search <text>] [--is-built-in] [--json]

  Organizations (/iam/v4/iam/organizations*):
    blocks-os iam:organizations:list [--page] [--page-size] [--search] [--ids a,b]
                              [--is-disabled] [--parent-organization-id] [--json]
    blocks-os iam:organizations:get <id> [--json]
    blocks-os iam:organizations:create --name <n> [--description] [--email] [--phone-number]
                              [--website-url] [--default-roles a,b] [--default-permissions a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os iam:organizations:update <id> [--name] [--description] [--email]
                              [--phone-number] [--website-url] [--industry] [--time-zone]
                              [--currency] [--locale] [--is-enabled]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os iam:organizations:my [--json]
    blocks-os iam:organizations:config:get [--json]
    blocks-os iam:organizations:config:save [--allow-org-creation-from-cloud]
                              [--allow-org-creation-from-construct] [--allow-org-creation-from-signup]
                              [--allow-org-creation-from-portal] [--multi-org-enabled]
                              [--consent-for-multi-org-enable] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]

  Signup settings (/iam/v4/iam/signup-settings):
    blocks-os iam:signup-settings:get [--json]
    blocks-os iam:signup-settings:save [--email-password-signup] [--sso-signup]
                              [--default-roles a,b] [--default-permissions a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

MFA (/iam/v4/mfa*, project-scoped: requires a selected project, impersonated project token only):
  blocks-os mfa:config:get [--json]
    Read the tenant's MFA policy.
  blocks-os mfa:config:save [--enable] [--require-for-all-users] [--allow-user-opt-out]
                              [--allow-backup-codes] [--backup-codes-count <n>]
                              [--user-mfa-type 0,1] [--required-roles a,b] [--exempt-roles a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Save the tenant's MFA policy.
  blocks-os mfa:totp:setup [--json]
    Start TOTP enrollment for the impersonated user.
  blocks-os mfa:totp:verify-setup <code> [--json]
    Confirm TOTP enrollment.
  blocks-os mfa:generate --mfa-type <n> [--send-phone-number-as-email-domain <domain>] [--json]
    Send an OTP challenge; returns an mfaId to pass to resend/verify.
  blocks-os mfa:resend <mfaId> [--send-phone-number-as-email-domain <domain>] [--json]
  blocks-os mfa:verify <mfaId> <code> --auth-type <n> [--from-token-call] [--json]
  blocks-os mfa:method:set --mfa-type <n> [--json]
    Switch the impersonated user's active MFA method.
  blocks-os mfa:disable [--dry-run] [--yes] [--json]
  blocks-os mfa:backup-codes:list [--json]
  blocks-os mfa:backup-codes:generate [--dry-run] [--yes] [--json]
  blocks-os mfa:backup-codes:use <userId> <code> [--json]

Auth Admin (/iam/v4/auth/identity-providers*, /config, /client-credentials, /oidc-clients —
            project-scoped: requires a selected project, impersonated project token only):
  blocks-os auth:idp:list [--json]
  blocks-os auth:idp:get <id> [--json]
  blocks-os auth:idp:create --provider <p> --provider-type <t> --protocol <proto>
                              --client-id <id> [--client-secret] [--display-name] [--issuer]
                              [--scope] [--redirect-uris a,b] [--active]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Rich provider configs (JWKS, private keys, initial roles, etc.) go in --body/--file;
    the flags above cover the common OAuth/OIDC fields.
  blocks-os auth:idp:update <id> [same flags as create, all optional] [--dry-run] [--yes] [--json]
    provider/providerType/protocol/clientId are immutable: omit them, or echo the
    existing values exactly if you also pass --body/--file.
  blocks-os auth:idp:delete <id> [--dry-run] [--yes] [--json]
    Irreversible; also deletes the related OIDC client registration.
  blocks-os auth:idp:status <id> --active|--active=false [--dry-run] [--yes] [--json]
    Enable/disable a provider without deleting its configuration.
  blocks-os auth:config:get [--json]
  blocks-os auth:config:save [--refresh-token-minutes] [--absolute-refresh-token-minutes]
                              [--access-token-minutes] [--remember-me-refresh-token-minutes]
                              [--wrong-attempts-to-lock] [--account-lock-duration-minutes]
                              [--oidc-enabled] [--logout-on-password-change]
                              [--password-strength-regex] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
  blocks-os auth:client-credentials:list [--json]
    clientSecret is included in list responses; treat CLI output as sensitive.
  blocks-os auth:client-credentials:save --name <n> [--item-id <id>] [--roles a,b]
                              [--permissions a,b] [--access-token-valid-minutes] [--active]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Omit --item-id to create; pass it to update. The response's clientSecret is
    shown once and is not retrievable again afterward.
  blocks-os auth:client-credentials:delete <id> [--dry-run] [--yes] [--json]

  blocks-os auth:oidc-clients:list [--json]
    List registered OAuth 2.0 / OIDC client applications for the tenant. client_secret
    is excluded from list/get responses.
  blocks-os auth:oidc-clients:get <clientId> [--json]
  blocks-os auth:oidc-clients:save [--item-id <id>] [--client-display-name] [--client-type]
                              [--redirect-uris a,b] [--post-logout-redirect-uris a,b]
                              [--scope] [--allowed-scopes a,b] [--allowed-response-types a,b]
                              [--require-pkce] [--require-consent] [--require-mfa]
                              [--allowed-mfa-methods 0,1] [--front-channel-logout-uri]
                              [--back-channel-logout-uri] [--auto-redirect]
                              [--external-discovery-endpoint] [--active] [--login-mode]
                              [--client-logo-url] [--client-brand-color] [--use-tokens-cookie]
                              [--register-as-identity-provider] [--device-flow-client]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to register a new client, pass it to update an existing one.
    The response's client_secret is shown once and is not retrievable again afterward.
  blocks-os auth:oidc-clients:delete <clientId> [--dry-run] [--yes] [--json]
    Irreversible; revokes all tokens issued to the client.
  blocks-os auth:oidc-clients:rotate-secret <clientId> [--dry-run] [--yes] [--json]
    Generates a new client_secret, shown once; the old secret stops working immediately.

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
