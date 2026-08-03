import { authRefresh } from "./commands/auth/refresh.js";
import { authRemove } from "./commands/auth/remove.js";
import { authStatus } from "./commands/auth/status.js";
import { deselectProject } from "./commands/deselect.js";
import { doctor } from "./commands/doctor.js";
import { dataReload } from "./commands/data/reload.js";
import { dataValidate } from "./commands/data/validate.js";
import { dataConfigCreate } from "./commands/data/config/create.js";
import { dataConfigGet } from "./commands/data/config/get.js";
import { dataConfigUpdate } from "./commands/data/config/update.js";
import { dataRulesDeploy } from "./commands/data/rules/deploy.js";
import { dataRulesPull } from "./commands/data/rules/pull.js";
import { dataRulesPolicyDelete } from "./commands/data/rules/policy/delete.js";
import { dataRulesPolicyGet } from "./commands/data/rules/policy/get.js";
import { dataSchemaList } from "./commands/data/schema/list.js";
import { dataSchemaPull } from "./commands/data/schema/pull.js";
import { dataSchemaPush } from "./commands/data/schema/push.js";
import { dataSchemaAggregation } from "./commands/data/schema/aggregation.js";
import { dataSchemaChangeLogs } from "./commands/data/schema/change-logs.js";
import { dataSchemaDelete } from "./commands/data/schema/delete.js";
import { dataSchemaFields } from "./commands/data/schema/fields.js";
import { dataSchemaGet } from "./commands/data/schema/get.js";
import { dataSchemaGetByName } from "./commands/data/schema/get-by-name.js";
import { dataSchemaInfoList } from "./commands/data/schema/info/list.js";
import { dataSchemaInfoSave } from "./commands/data/schema/info/save.js";
import { dataSchemaInfoUpdate } from "./commands/data/schema/info/update.js";
import { dataValidationBySchema } from "./commands/data/validation/by-schema.js";
import { dataValidationBySchemaField } from "./commands/data/validation/by-schema-field.js";
import { dataValidationDelete } from "./commands/data/validation/delete.js";
import { dataValidationGet } from "./commands/data/validation/get.js";
import { dataValidationList } from "./commands/data/validation/list.js";
import { dataValidationSave } from "./commands/data/validation/save.js";
import { dataFilesCreateFolder } from "./commands/data/files/create-folder.js";
import { dataFilesDelete } from "./commands/data/files/delete.js";
import { dataFilesDeleteFolder } from "./commands/data/files/delete-folder.js";
import { dataFilesDmsList } from "./commands/data/files/dms-list.js";
import { dataFilesDmsUpload } from "./commands/data/files/dms-upload.js";
import { dataFilesGet } from "./commands/data/files/get.js";
import { dataFilesGetMany } from "./commands/data/files/get-many.js";
import { dataFilesInfo } from "./commands/data/files/info.js";
import { dataFilesPresignedUploadUrl } from "./commands/data/files/presigned-upload-url.js";
import { dataFilesUpdateAdditionalInfo } from "./commands/data/files/update-additional-info.js";
import { dataFilesUploadToLocalStorage } from "./commands/data/files/upload-to-local-storage.js";
import { dataFilesUploadToUrl } from "./commands/data/files/upload-to-url.js";
import { iamMe } from "./commands/iam/me.js";
import { init } from "./commands/init.js";
import { localizationAssistantTranslationSuggestion } from "./commands/localization/assistant/translation-suggestion.js";
import { localizationConfigGetWebhook } from "./commands/localization/config/get-webhook.js";
import { localizationConfigSaveWebhook } from "./commands/localization/config/save-webhook.js";
import { localizationGlossaryDelete } from "./commands/localization/glossary/delete.js";
import { localizationGlossaryGet } from "./commands/localization/glossary/get.js";
import { localizationGlossaryList } from "./commands/localization/glossary/list.js";
import { localizationGlossarySave } from "./commands/localization/glossary/save.js";
import { localizationGlossarySuggested } from "./commands/localization/glossary/suggested.js";
import { localizationKeyDelete } from "./commands/localization/key/delete.js";
import { localizationKeyDeleteKeys } from "./commands/localization/key/delete-keys.js";
import { localizationKeyGenerateUilmFile } from "./commands/localization/key/generate-uilm-file.js";
import { localizationKeyGet } from "./commands/localization/key/get.js";
import { localizationKeyGetByNames } from "./commands/localization/key/get-by-names.js";
import { localizationKeyGetLanguageFileGenerationHistory } from "./commands/localization/key/get-language-file-generation-history.js";
import { localizationKeyGetLocalizationTimeline } from "./commands/localization/key/get-localization-timeline.js";
import { localizationKeyGetTimeline } from "./commands/localization/key/get-timeline.js";
import { localizationKeyGetTimelineByOperationId } from "./commands/localization/key/get-timeline-by-operation-id.js";
import { localizationKeyGetUilmExportedFiles } from "./commands/localization/key/get-uilm-exported-files.js";
import { localizationKeyGetUilmFile } from "./commands/localization/key/get-uilm-file.js";
import { localizationKeyList } from "./commands/localization/key/list.js";
import { localizationKeyRollback } from "./commands/localization/key/rollback.js";
import { localizationKeySave } from "./commands/localization/key/save.js";
import { localizationKeyTranslateAll } from "./commands/localization/key/translate-all.js";
import { localizationKeyTranslateKey } from "./commands/localization/key/translate-key.js";
import { localizationKeyTranslateKeys } from "./commands/localization/key/translate-keys.js";
import { localizationKeyUilmExport } from "./commands/localization/key/uilm-export.js";
import { localizationKeyUilmImport } from "./commands/localization/key/uilm-import.js";
import { localizationLanguageDelete } from "./commands/localization/language/delete.js";
import { localizationLanguageList } from "./commands/localization/language/list.js";
import { localizationLanguageListForTenant } from "./commands/localization/language/list-for-tenant.js";
import { localizationLanguageSave } from "./commands/localization/language/save.js";
import { localizationLanguageSetDefault } from "./commands/localization/language/set-default.js";
import { localizationModuleList } from "./commands/localization/module/list.js";
import { localizationModuleListForTenant } from "./commands/localization/module/list-for-tenant.js";
import { localizationModuleSave } from "./commands/localization/module/save.js";
import { localizationModuleTagGlossary } from "./commands/localization/module/tag-glossary.js";
import { localizationPull } from "./commands/localization/pull.js";
import { localizationPush } from "./commands/localization/push.js";
import { localizationValidate } from "./commands/localization/validate.js";
import { login } from "./commands/login.js";
import { logout } from "./commands/logout.js";
import { newWeb } from "./commands/new/web.js";
// import { createProject } from "./commands/projects/create.js"; // disabled for now
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
import { mailConfigDelete } from "./commands/mail/config/delete.js";
import { mailConfigDuplicate } from "./commands/mail/config/duplicate.js";
import { mailConfigGet } from "./commands/mail/config/get.js";
import { mailConfigList } from "./commands/mail/config/list.js";
import { mailConfigSave } from "./commands/mail/config/save.js";
import { mailMailboxGet } from "./commands/mail/mailbox/get.js";
import { mailMailboxList } from "./commands/mail/mailbox/list.js";
import { mailTemplateClone } from "./commands/mail/template/clone.js";
import { mailTemplateDelete } from "./commands/mail/template/delete.js";
import { mailTemplateGet } from "./commands/mail/template/get.js";
import { mailTemplateList } from "./commands/mail/template/list.js";
import { mailTemplateSave } from "./commands/mail/template/save.js";
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
import { notificationDelete } from "./commands/notification/delete.js";
import { notificationGet } from "./commands/notification/get.js";
import { notificationList } from "./commands/notification/list.js";
import { notificationSave } from "./commands/notification/save.js";
import { storageConfigDelete } from "./commands/storage/config/delete.js";
import { storageConfigGet } from "./commands/storage/config/get.js";
import { storageConfigList } from "./commands/storage/config/list.js";
import { storageConfigSave } from "./commands/storage/config/save.js";
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
  } else if (command === "data:config:get") {
    await dataConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:config:create") {
    await dataConfigCreate([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:config:update") {
    await dataConfigUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:get") {
    await dataSchemaGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:get-by-name") {
    await dataSchemaGetByName([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:aggregation") {
    await dataSchemaAggregation([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:change-logs") {
    await dataSchemaChangeLogs([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:delete") {
    await dataSchemaDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:fields") {
    await dataSchemaFields([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:info:list") {
    await dataSchemaInfoList([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:info:save") {
    await dataSchemaInfoSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:schema:info:update") {
    await dataSchemaInfoUpdate([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:rules:policy:get") {
    await dataRulesPolicyGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:rules:policy:delete") {
    await dataRulesPolicyDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:list") {
    await dataValidationList([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:get") {
    await dataValidationGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:by-schema") {
    await dataValidationBySchema([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:by-schema-field") {
    await dataValidationBySchemaField([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:save") {
    await dataValidationSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:validation:delete") {
    await dataValidationDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:get") {
    await dataFilesGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:get-many") {
    await dataFilesGetMany([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:info") {
    await dataFilesInfo([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:presigned-upload-url") {
    await dataFilesPresignedUploadUrl([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:upload-to-url") {
    await dataFilesUploadToUrl([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:upload-to-local-storage") {
    await dataFilesUploadToLocalStorage([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:update-additional-info") {
    await dataFilesUpdateAdditionalInfo([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:delete") {
    await dataFilesDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:dms-list") {
    await dataFilesDmsList([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:dms-upload") {
    await dataFilesDmsUpload([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:create-folder") {
    await dataFilesCreateFolder([subcommand, ...rest].filter(Boolean));
  } else if (command === "data:files:delete-folder") {
    await dataFilesDeleteFolder([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:validate") {
    await localizationValidate([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:push") {
    await localizationPush([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:pull") {
    await localizationPull([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:assistant:translation-suggestion") {
    await localizationAssistantTranslationSuggestion([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:config:get-webhook") {
    await localizationConfigGetWebhook([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:config:save-webhook") {
    await localizationConfigSaveWebhook([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:glossary:save") {
    await localizationGlossarySave([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:glossary:list") {
    await localizationGlossaryList([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:glossary:get") {
    await localizationGlossaryGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:glossary:suggested") {
    await localizationGlossarySuggested([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:glossary:delete") {
    await localizationGlossaryDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:save") {
    await localizationKeySave([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:list") {
    await localizationKeyList([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-by-names") {
    await localizationKeyGetByNames([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-timeline") {
    await localizationKeyGetTimeline([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-localization-timeline") {
    await localizationKeyGetLocalizationTimeline([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-timeline-by-operation-id") {
    await localizationKeyGetTimelineByOperationId([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get") {
    await localizationKeyGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:delete") {
    await localizationKeyDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:delete-keys") {
    await localizationKeyDeleteKeys([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-uilm-file") {
    await localizationKeyGetUilmFile([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:generate-uilm-file") {
    await localizationKeyGenerateUilmFile([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:translate-all") {
    await localizationKeyTranslateAll([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:translate-key") {
    await localizationKeyTranslateKey([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:translate-keys") {
    await localizationKeyTranslateKeys([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:uilm-import") {
    await localizationKeyUilmImport([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:uilm-export") {
    await localizationKeyUilmExport([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-uilm-exported-files") {
    await localizationKeyGetUilmExportedFiles([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:get-language-file-generation-history") {
    await localizationKeyGetLanguageFileGenerationHistory([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:key:rollback") {
    await localizationKeyRollback([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:language:save") {
    await localizationLanguageSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:language:list") {
    await localizationLanguageList([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:language:list-for-tenant") {
    await localizationLanguageListForTenant([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:language:delete") {
    await localizationLanguageDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:language:set-default") {
    await localizationLanguageSetDefault([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:module:save") {
    await localizationModuleSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:module:list") {
    await localizationModuleList([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:module:list-for-tenant") {
    await localizationModuleListForTenant([subcommand, ...rest].filter(Boolean));
  } else if (command === "localization:module:tag-glossary") {
    await localizationModuleTagGlossary([subcommand, ...rest].filter(Boolean));
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
  } else if (command === "mail:config:list") {
    await mailConfigList([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:config:get") {
    await mailConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:config:save") {
    await mailConfigSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:config:delete") {
    await mailConfigDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:config:duplicate") {
    await mailConfigDuplicate([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:template:list") {
    await mailTemplateList([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:template:get") {
    await mailTemplateGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:template:save") {
    await mailTemplateSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:template:delete") {
    await mailTemplateDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:template:clone") {
    await mailTemplateClone([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:mailbox:list") {
    await mailMailboxList([subcommand, ...rest].filter(Boolean));
  } else if (command === "mail:mailbox:get") {
    await mailMailboxGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "notification:list") {
    await notificationList([subcommand, ...rest].filter(Boolean));
  } else if (command === "notification:get") {
    await notificationGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "notification:save") {
    await notificationSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "notification:delete") {
    await notificationDelete([subcommand, ...rest].filter(Boolean));
  } else if (command === "storage:config:list") {
    await storageConfigList([subcommand, ...rest].filter(Boolean));
  } else if (command === "storage:config:get") {
    await storageConfigGet([subcommand, ...rest].filter(Boolean));
  } else if (command === "storage:config:save") {
    await storageConfigSave([subcommand, ...rest].filter(Boolean));
  } else if (command === "storage:config:delete") {
    await storageConfigDelete([subcommand, ...rest].filter(Boolean));
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
    return {
      code: "not_logged_in",
      message,
      nextStep: "blocks-os login, then blocks-os projects list, then blocks-os use <tenantId>"
    };
  }

  if (message.includes("token expired") || message.includes("refresh token") || message.includes("cannot decrypt")) {
    return { code: "auth_repair_required", message, nextStep: "blocks-os login" };
  }

  if (message.includes("No project selected")) {
    return {
      code: "project_not_selected",
      message,
      nextStep: "blocks-os projects list, then blocks-os use <tenantId>"
    };
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
    and .env.example.

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

  blocks-os projects:get [tenantId] [--deployment] [--json]
    Read one project from Project/Gets. Uses selected project when tenantId is
    omitted. Pass --deployment to also include the environment, tenantGroupId,
    and linked repo assets (from Project/GetAsset) that 'release:deploy' uses
    to resolve its target. Read-only.

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

Mail (/os/v4/Mail/* — project-scoped: requires a selected project, impersonated project token only):
  blocks-os mail:config:list [--json]
    List SMTP/inbound mail configurations for the selected project.
  blocks-os mail:config:get <name> [--json]
  blocks-os mail:config:save [--configuration-id <id>] [--name <n>] [--host <h>] [--port <n>]
                              [--enable-ssl] [--sender-name] [--sender-address] [--sender-username]
                              [--account-password] [--inbound] [--provider <0|1>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --configuration-id to create; pass it to update.
  blocks-os mail:config:delete <configurationId> [--dry-run] [--yes] [--json]
  blocks-os mail:config:duplicate <configurationId> [--dry-run] [--yes] [--json]
  blocks-os mail:template:list [--page-number] [--page-size] [--search] [--sort-by] [--sort-desc]
                              [--configuration-id] [--language] [--json]
  blocks-os mail:template:get <itemId> [--json]
  blocks-os mail:template:save [--item-id <id>] [--configuration-id] [--name] [--language]
                              [--subject] [--template-body] [--json-content] [--image-id]
                              [--image-url] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to create; pass it to update.
  blocks-os mail:template:delete <itemId> [--dry-run] [--yes] [--json]
  blocks-os mail:template:clone <itemId> [--configuration-id] [--language] [--name] [--subject]
                              [--dry-run] [--yes] [--json]
  blocks-os mail:mailbox:list [--page-number] [--page-size] [--status] [--search]
                              [--start-date] [--end-date] [--inbound] [--json]
  blocks-os mail:mailbox:get <messageId> [--json]

Notification (/os/v4/Notification/* — project-scoped: requires a selected project, impersonated project token only):
  blocks-os notification:list [--page] [--page-size] [--sort-by] [--sort-desc] [--filter] [--json]
  blocks-os notification:get <itemId> [--json]
  blocks-os notification:save [--name <n>] [--channel <0|1>] [--type <0-3>] [--enable-persistence]
                              [--notify-method] [--update] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    Pass --update when saving over an existing notification configuration.
  blocks-os notification:delete <itemId> [--dry-run] [--yes] [--json]

Storage (/os/v4/Storage/* — project-scoped: requires a selected project, impersonated project token only):
  blocks-os storage:config:list [--json]
  blocks-os storage:config:get <name> [--json]
  blocks-os storage:config:save [--item-id <id>] [--name <n>] [--strategy] [--connection-string]
                              [--secret-key] [--access-key] [--region-endpoint] [--host] [--port]
                              [--username] [--password] [--remote-base-path] [--update]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to create; pass --update to update.
  blocks-os storage:config:delete <name> [--dry-run] [--yes] [--json]

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

  Data source configuration (/data/v4/configurations) - check this first; by default a
  project's Data Gateway runs on Blocks-managed storage and data:config:get is all you need.
  Only create/update a configuration if you're pointing the gateway at your own database.
    blocks-os data:config:get [--json]
    blocks-os data:config:create --connection-string <cs> [--database-name <name>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os data:config:update --item-id <id> [--connection-string] [--database-name]
                              [--collection-name-editable] [--collection-name-pattern]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

  Raw Schema API (/data/v4/schemas* - beyond the file-oriented list/pull/push above):
    blocks-os data:schema:get <id> [--json]
    blocks-os data:schema:get-by-name <schemaName> [--json]
      Full field-level detail by collection name (info-by-name).
    blocks-os data:schema:aggregation [--keyword] [--schema-name] [--collection-name]
                              [--schema-type <1|2>] [--page] [--page-size] [--sort-by]
                              [--sort-desc] [--json]
      Schemas plus an access-level summary (Public/User/Custom x Read/Write/Edit/Delete).
    blocks-os data:schema:change-logs [--json]
      Unadapted schema change logs; data:reload clears these.
    blocks-os data:schema:delete <id> [--dry-run] [--yes] [--json]
      Irreversible.
    blocks-os data:schema:info:list [--json]
      Entity-type schema collections with basic info.
    blocks-os data:schema:info:save --schema-name <n> [--collection-name] [--schema-type <1|2>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
      Create schema metadata only (no fields yet) - pair with data:schema:fields.
    blocks-os data:schema:info:update --item-id <id> [--schema-name] [--collection-name]
                              [--schema-type <1|2>] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks-os data:schema:fields --schema-id <schemaDefinitionItemId> [--deletable-fields a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
      Add/update field definitions; the 'fields' array (name/type/isArray/isPIIData/
      isUniqueData/description) goes in --body/--file, e.g.
      --body '{"fields":[{"name":"email","type":"string"}]}'.

  Data-access policies, single-item ops (beyond the file-oriented rules:pull/deploy above):
    blocks-os data:rules:policy:get <schemaName> [--json]
    blocks-os data:rules:policy:delete <itemId> [--dry-run] [--yes] [--json]

  Data validation (/data/v4/data-validations* - field-level validation rules; no file-oriented
                    workflow exists for this yet, use these directly):
    blocks-os data:validation:list [--schema-id] [--field-name] [--keyword] [--page]
                              [--page-size] [--sort-by] [--sort-desc] [--json]
    blocks-os data:validation:get <validationId> [--json]
    blocks-os data:validation:by-schema <schemaId> [--json]
    blocks-os data:validation:by-schema-field <schemaId> <fieldName> [--json]
    blocks-os data:validation:save --schema-id <id> --field-name <name> [--item-id]
                              --body '<json>' (must include a "validations" array, e.g.
                              '{"validations":[{"type":1,"value":"^[0-9]+$","isActive":true}]}')
                              [--dry-run] [--yes] [--json]
      Upsert: omit --item-id to create, pass it to update.
    blocks-os data:validation:delete <validationId> [--dry-run] [--yes] [--json]

  Files / DMS (/data/v4/Files/* - storage and document management; no SDK required, but see
                the blocks-data-storage skill if writing this into app code instead of scripting it):
    blocks-os data:files:get <fileId> [--version] [--configuration-name] [--json]
    blocks-os data:files:get-many <fileId...>|--file-ids a,b [--configuration-name] [--json]
    blocks-os data:files:info [--name] [--tenant-id] [--page] [--page-size] [--sort-by]
                              [--sort-desc] [--json]
    blocks-os data:files:presigned-upload-url --name <fileName> [--parent-directory-id]
                              [--access-modifier Public|Private] [--configuration-name]
                              [--module-name <1-11>] [--meta-data] [--tags]
                              [--body '<json>'|--file <path>] [--json]
      Cloud-storage upload, step 1 of 2. Returns an uploadUrl and fileId; PUT the bytes next
      with data:files:upload-to-url.
    blocks-os data:files:upload-to-url --url <presignedUrl> --file <localPath>
                              --content-type <type> [--blob-type BlockBlob] [--no-blob-type-header]
                              [--dry-run] [--yes] [--json]
      Step 2. Provider-direct PUT - no Blocks auth headers by design.
    blocks-os data:files:upload-to-local-storage --file <localPath> [--name] [--item-id]
                              [--parent-directory-id] [--tags] [--access-modifier Public|Private]
                              [--configuration-name] [--meta-data] [--additional-properties '<json>']
                              [--dry-run] [--yes] [--json]
      One-call alternative to the two commands above, for local-storage-backed projects.
    blocks-os data:files:update-additional-info <itemId> --additional-properties '<json>'
                              [--dry-run] [--yes] [--json]
    blocks-os data:files:delete <fileId> [--configuration-name] [--event-queue-name]
                              [--dry-run] [--yes] [--json]
    blocks-os data:files:dms-list [--parent-id] [--search] [--configuration-name] [--take]
                              [--skip] [--json]
      Combined folder+file listing for a DMS parent ("" = root).
    blocks-os data:files:dms-upload --file-storage-id <id> --artifact-name <name>
                              [--parent-id] [--tags a,b] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
      Registers an uploaded file (fileId from presigned-upload-url/upload-to-local-storage)
      so it appears in a DMS folder. Upload alone does not make a file visible in a folder.
    blocks-os data:files:create-folder <name> [--parent-id] [--description] [--tags a,b]
                              [--configuration-name] [--dry-run] [--yes] [--json]
    blocks-os data:files:delete-folder <folderId> [--configuration-name]
                              [--dry-run] [--yes] [--json]

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

  Raw API (/localization/v4/* — project-scoped: requires a selected project, impersonated
            project token only). These call the Localization service endpoints directly,
            in addition to the file-oriented validate/push/pull commands above.

    blocks-os localization:assistant:translation-suggestion --source-text <text>
                              --destination-language <culture> [--current-language]
                              [--element-type] [--element-application-context]
                              [--element-detail-context] [--temperature] [--max-character-length]
                              [--glossary-ids a,b] [--module-id] [--destination-language-code]
                              [--body '<json>'|--file <path>] [--json]

    blocks-os localization:config:get-webhook [--json]
    blocks-os localization:config:save-webhook --url <url> --content-type <type>
                              --secret <s> --header-key <k> [--item-id <id>] [--is-disabled]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

    blocks-os localization:glossary:save --name <n> [--item-id] [--language] [--type]
                              [--context] [--additional-note] [--is-global] [--module-ids a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os localization:glossary:list [--search] [--page-number] [--page-size]
                              [--is-global] [--module-id] [--json]
    blocks-os localization:glossary:get <itemId> [--json]
    blocks-os localization:glossary:suggested <itemId> [--max-results <n>] [--json]
    blocks-os localization:glossary:delete <itemId> [--dry-run] [--yes] [--json]

    blocks-os localization:key:save --key-name <n> --module-id <id> [--item-id] [--value]
                              [--culture] [--routes a,b] [--glossary-ids a,b] [--context]
                              [--is-new-key] [--is-partially-translated] [--should-publish]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os localization:key:list [--key-search-text] [--search-key] [--module-ids a,b]
                              [--page-number] [--page-size] [--sort-by] [--sort-desc]
                              [--is-partially-translated] [--missing-languages a,b]
                              [--create-date-start] [--create-date-end]
                              [--last-update-date-start] [--last-update-date-end]
                              [--glossary-id] [--body '<json>'|--file <path>] [--json]
    blocks-os localization:key:get-by-names <keyName...>|--key-names a,b [--module-id] [--json]
    blocks-os localization:key:get <itemId> [--json]
    blocks-os localization:key:delete <itemId> [--dry-run] [--yes] [--json]
    blocks-os localization:key:delete-keys <itemId...>|--item-ids a,b [--dry-run] [--yes] [--json]
    blocks-os localization:key:get-timeline [--entity-id] [--user-id] [--page-number]
                              [--page-size] [--sort-by] [--sort-desc] [--create-date-start]
                              [--create-date-end] [--json]
    blocks-os localization:key:get-localization-timeline [--user-id] [--log-from]
                              [--log-from-values a,b] [--exclude-log-from-values a,b]
                              [--page-number] [--page-size] [--sort-by] [--sort-desc]
                              [--create-date-start] [--create-date-end] [--json]
    blocks-os localization:key:get-timeline-by-operation-id <operationId> [--page-number]
                              [--page-size] [--json]
    blocks-os localization:key:get-uilm-file --module <name> --language <culture> [--json]
    blocks-os localization:key:generate-uilm-file --module-id <id> [--guid]
                              [--dry-run] [--yes] [--json]
    blocks-os localization:key:translate-all --module-id <id> [--default-language]
                              [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks-os localization:key:translate-key <keyId> --default-language <culture>
                              [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks-os localization:key:translate-keys <keyId...>|--key-ids a,b --default-language <culture>
                              [--message-co-relation-id] [--project-key]
                              [--dry-run] [--yes] [--json]
    blocks-os localization:key:uilm-import <fileId> [--message-co-relation-id]
                              [--dry-run] [--yes] [--json]
    blocks-os localization:key:uilm-export [--output-type <0-5>] [--app-ids a,b] [--languages a,b]
                              [--reference-file-id] [--caller-tenant-id] [--start-date]
                              [--end-date] [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks-os localization:key:get-uilm-exported-files [--search] [--page-number] [--page-size]
                              [--create-date-start] [--create-date-end] [--json]
    blocks-os localization:key:get-language-file-generation-history [--page-number]
                              [--page-size] [--json]
    blocks-os localization:key:rollback <itemId> [--dry-run] [--yes] [--json]

    blocks-os localization:language:save --language-name <n> --language-code <c> [--item-id]
                              [--is-default] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks-os localization:language:list [--json]
    blocks-os localization:language:list-for-tenant [--json]
    blocks-os localization:language:delete <languageName> [--dry-run] [--yes] [--json]
    blocks-os localization:language:set-default <languageName> [--dry-run] [--yes] [--json]

    blocks-os localization:module:save --module-name <n> [--item-id]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks-os localization:module:list [--json]
    blocks-os localization:module:list-for-tenant [--json]
    blocks-os localization:module:tag-glossary <moduleId> --glossary-ids a,b
                              [--dry-run] [--yes] [--json]

Release:
  blocks-os release:deploy [--domain <customDomain>] [--dry-run] [--yes] [--json]
    Deploy the selected project's environment. Resolves everything from state
    you already have: the repo linked to this project (Project/GetAsset) and
    that repo's connected branch (Build/repo-details) -- no --repo-id needed.
    Aborts if the connected branch doesn't match this environment's name.
    Pass --domain to also set the custom deployment domain before deploying.
    Mutating; no artifact upload is performed by this CLI.

  blocks-os release:status <buildId> [--json]
    Read Release build status by build id using an impersonated project
    token. Read-only.

  blocks-os release:builds:list [repoId] [--repo-id <repoId>] [--json]
    List Release build details for a repository using an impersonated project
    token. When repoId is omitted, resolves it from the selected project's
    linked repo assets (Project/GetAsset, account token) -- auto-picked if
    there's exactly one, otherwise you're prompted to choose. Read-only.

  blocks-os release:builds:get <buildId> [--json]
    Alias for release:status. Read-only.

Scaffold:
  blocks-os new web <name> [--app-domain <domain>] [--client-id <oidcClientId>]
                    [--x-blocks-key <tenantId>] [--blocks-api-url <url>] [--oidc-url <url>]
    Create a Vite React starter app with a real browser Authorization Code +
    PKCE login flow against Blocks IAM (login page, /login/callback handler,
    route guards), plus Data schema listing, Release build lookup, environment
    config, and safe .gitignore defaults.
    Uses the selected project (see 'use') unless --x-blocks-key overrides it.
    --app-domain and --client-id are resolved from the project when omitted:
    if the project has one domain it's used automatically, otherwise you're
    prompted to choose; the OIDC client is picked from a list of the
    project's existing clients, or you can create a minimal one (display
    name + redirect URI, active, registered as a Blocks OIDC identity
    provider) on the spot, or skip and register one later from the portal or
    'auth:oidc-clients:save'.
    --blocks-api-url defaults to the OS API (os.seliseblocks.com) if omitted -
    pass the runtime Data/IAM/Localization gateway URL explicitly (typically
    https://api.seliseblocks.com) for the scaffolded app to work at runtime.
    --oidc-url defaults to https://iam.seliseblocks.com.
`);
}
