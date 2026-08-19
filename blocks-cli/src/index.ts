import { authRefresh } from "./commands/auth/refresh.js";
import { authRemove } from "./commands/auth/remove.js";
import { authStatus } from "./commands/auth/status.js";
import { deselectProject } from "./commands/deselect.js";
import { doctor } from "./commands/doctor.js";
import { dataReload } from "./commands/data/reload.js";
import { dataSync } from "./commands/data/sync.js";
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
import { dataFilesDelete } from "./commands/data/files/delete.js";
import { dataFilesGet } from "./commands/data/files/get.js";
import { dataFilesGetMany } from "./commands/data/files/get-many.js";
import { dataFilesInfo } from "./commands/data/files/info.js";
import { dataFilesPresignedUploadUrl } from "./commands/data/files/presigned-upload-url.js";
import { dataFilesUpdateAdditionalInfo } from "./commands/data/files/update-additional-info.js";
import { dataFilesUpload } from "./commands/data/files/upload.js";
import { dataFilesUploadToLocalStorage } from "./commands/data/files/upload-to-local-storage.js";
import { dataFilesUploadToUrl } from "./commands/data/files/upload-to-url.js";
import {
  dataFilesAccessGrant,
  dataFilesAccessList,
  dataFilesAccessResolve,
  dataFilesAccessRevoke,
  dataFilesAccessUpdate,
  dataFilesCopy,
  dataFilesCreateVersion,
  dataFilesDirectoryCreate,
  dataFilesDirectoryDelete,
  dataFilesDirectoryGet,
  dataFilesDirectoryMove,
  dataFilesDirectoryUpdate,
  dataFilesInheritance,
  dataFilesList,
  dataFilesMove,
  dataFilesPurge,
  dataFilesRename,
  dataFilesRestore,
  dataFilesSearch,
  dataFilesShare,
  dataFilesShared,
  dataFilesTrash,
  dataFilesVersions
} from "./commands/data/files/object-tree.js";
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
import { localizationKeyTranslateAndExport } from "./commands/localization/key/translate-and-export.js";
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
import { sdkClient } from "./commands/sdk/client.js";
import { skillAdd } from "./commands/skill/add.js";
import { skillList } from "./commands/skill/list.js";
import { skillShow } from "./commands/skill/show.js";
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
import { mailSend } from "./commands/mail/send.js";
import { mailSendToAny } from "./commands/mail/sendtoany.js";
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
import { mfaTotpEnable } from "./commands/mfa/totp-enable.js";
import { mfaTotpSetup } from "./commands/mfa/totp-setup.js";
import { mfaTotpVerifySetup } from "./commands/mfa/totp-verify-setup.js";
import { mfaVerify } from "./commands/mfa/verify.js";
import { notificationDelete } from "./commands/notification/delete.js";
import { notificationGet } from "./commands/notification/get.js";
import { notificationList } from "./commands/notification/list.js";
import { notificationSave } from "./commands/notification/save.js";
import { notifierList } from "./commands/notifier/list.js";
import { notifierMarkAllRead } from "./commands/notifier/mark-all-read.js";
import { notifierMarkRead } from "./commands/notifier/mark-read.js";
import { notifierNotify } from "./commands/notifier/notify.js";
import { notifierUnread } from "./commands/notifier/unread.js";
import { secretsGet } from "./commands/secrets/get.js";
import { secretsSave } from "./commands/secrets/save.js";
import { storageConfigDelete } from "./commands/storage/config/delete.js";
import { storageConfigGet } from "./commands/storage/config/get.js";
import { storageConfigList } from "./commands/storage/config/list.js";
import { storageConfigSave } from "./commands/storage/config/save.js";
import { CliActionableError } from "./lib/errors.js";

type CommandHandler = (args: string[]) => Promise<void>;

// Every command below is reachable with either colon or space separators,
// e.g. "auth:status" and "auth status" both resolve to authStatus. Keys are
// the canonical colon-joined form; the deepest is 4 segments
// (e.g. iam:users:access:grant).
const commands: Partial<Record<string, CommandHandler>> = {
  "auth:status": authStatus,
  "auth:refresh": authRefresh,
  "doctor": doctor,
  "init": () => init(),
  "login": login,
  "logout": logout,
  "projects:list": listProjects,
  "use": useProject,
  "deselect": deselectProject,
  "data:schema:list": dataSchemaList,
  "data:schema:pull": dataSchemaPull,
  "data:schema:push": dataSchemaPush,
  "data:rules:pull": dataRulesPull,
  "data:rules:deploy": dataRulesDeploy,
  "data:reload": dataReload,
  "data:sync": dataSync,
  "data:validate": dataValidate,
  "data:config:get": dataConfigGet,
  "data:config:create": dataConfigCreate,
  "data:config:update": dataConfigUpdate,
  "data:schema:get": dataSchemaGet,
  "data:schema:get-by-name": dataSchemaGetByName,
  "data:schema:aggregation": dataSchemaAggregation,
  "data:schema:change-logs": dataSchemaChangeLogs,
  "data:schema:delete": dataSchemaDelete,
  "data:schema:fields": dataSchemaFields,
  "data:schema:info:list": dataSchemaInfoList,
  "data:schema:info:save": dataSchemaInfoSave,
  "data:schema:info:update": dataSchemaInfoUpdate,
  "data:rules:policy:get": dataRulesPolicyGet,
  "data:rules:policy:delete": dataRulesPolicyDelete,
  "data:validation:list": dataValidationList,
  "data:validation:get": dataValidationGet,
  "data:validation:by-schema": dataValidationBySchema,
  "data:validation:by-schema-field": dataValidationBySchemaField,
  "data:validation:save": dataValidationSave,
  "data:validation:delete": dataValidationDelete,
  "data:files:get": dataFilesGet,
  "data:files:get-many": dataFilesGetMany,
  "data:files:info": dataFilesInfo,
  "data:files:upload": dataFilesUpload,
  "data:files:presigned-upload-url": dataFilesPresignedUploadUrl,
  "data:files:upload-to-url": dataFilesUploadToUrl,
  "data:files:upload-to-local-storage": dataFilesUploadToLocalStorage,
  "data:files:update-additional-info": dataFilesUpdateAdditionalInfo,
  "data:files:delete": dataFilesDelete,
  "data:files:list": dataFilesList,
  "data:files:search": dataFilesSearch,
  "data:files:trash": dataFilesTrash,
  "data:files:shared": dataFilesShared,
  "data:files:restore": dataFilesRestore,
  "data:files:purge": dataFilesPurge,
  "data:files:directory-create": dataFilesDirectoryCreate,
  "data:files:directory-get": dataFilesDirectoryGet,
  "data:files:directory-update": dataFilesDirectoryUpdate,
  "data:files:directory-delete": dataFilesDirectoryDelete,
  "data:files:directory-move": dataFilesDirectoryMove,
  "data:files:versions": dataFilesVersions,
  "data:files:create-version": dataFilesCreateVersion,
  "data:files:copy": dataFilesCopy,
  "data:files:move": dataFilesMove,
  "data:files:rename": dataFilesRename,
  "data:files:access-list": dataFilesAccessList,
  "data:files:access-grant": dataFilesAccessGrant,
  "data:files:access-update": dataFilesAccessUpdate,
  "data:files:access-revoke": dataFilesAccessRevoke,
  "data:files:access-resolve": dataFilesAccessResolve,
  "data:files:inheritance": dataFilesInheritance,
  "data:files:share": dataFilesShare,
  "localization:validate": localizationValidate,
  "localization:push": localizationPush,
  "localization:pull": localizationPull,
  "localization:assistant:translation-suggestion": localizationAssistantTranslationSuggestion,
  "localization:config:get-webhook": localizationConfigGetWebhook,
  "localization:config:save-webhook": localizationConfigSaveWebhook,
  "localization:glossary:save": localizationGlossarySave,
  "localization:glossary:list": localizationGlossaryList,
  "localization:glossary:get": localizationGlossaryGet,
  "localization:glossary:suggested": localizationGlossarySuggested,
  "localization:glossary:delete": localizationGlossaryDelete,
  "localization:key:save": localizationKeySave,
  "localization:key:list": localizationKeyList,
  "localization:key:get-by-names": localizationKeyGetByNames,
  "localization:key:get-timeline": localizationKeyGetTimeline,
  "localization:key:get-localization-timeline": localizationKeyGetLocalizationTimeline,
  "localization:key:get-timeline-by-operation-id": localizationKeyGetTimelineByOperationId,
  "localization:key:get": localizationKeyGet,
  "localization:key:delete": localizationKeyDelete,
  "localization:key:delete-keys": localizationKeyDeleteKeys,
  "localization:key:get-uilm-file": localizationKeyGetUilmFile,
  "localization:key:generate-uilm-file": localizationKeyGenerateUilmFile,
  "localization:key:translate-all": localizationKeyTranslateAll,
  "localization:key:translate-and-export": localizationKeyTranslateAndExport,
  "localization:key:translate-key": localizationKeyTranslateKey,
  "localization:key:translate-keys": localizationKeyTranslateKeys,
  "localization:key:uilm-import": localizationKeyUilmImport,
  "localization:key:uilm-export": localizationKeyUilmExport,
  "localization:key:get-uilm-exported-files": localizationKeyGetUilmExportedFiles,
  "localization:key:get-language-file-generation-history": localizationKeyGetLanguageFileGenerationHistory,
  "localization:key:rollback": localizationKeyRollback,
  "localization:language:save": localizationLanguageSave,
  "localization:language:list": localizationLanguageList,
  "localization:language:list-for-tenant": localizationLanguageListForTenant,
  "localization:language:delete": localizationLanguageDelete,
  "localization:language:set-default": localizationLanguageSetDefault,
  "localization:module:save": localizationModuleSave,
  "localization:module:list": localizationModuleList,
  "localization:module:list-for-tenant": localizationModuleListForTenant,
  "localization:module:tag-glossary": localizationModuleTagGlossary,
  "release:deploy": releaseDeploy,
  "release:status": releaseStatus,
  "release:builds:list": releaseBuildsList,
  "release:builds:get": releaseBuildsGet,
  "iam:users:list": iamUsersList,
  "iam:users:get": iamUsersGet,
  "iam:users:create": iamUsersCreate,
  "iam:users:update": iamUsersUpdate,
  "iam:users:activate": iamUsersActivate,
  "iam:users:deactivate": iamUsersDeactivate,
  "iam:users:access:grant": iamUsersAccessGrant,
  "iam:users:access:revoke": iamUsersAccessRevoke,
  "iam:users:exists": iamUsersExists,
  "iam:email:available": iamEmailAvailable,
  "iam:roles:list": iamRolesList,
  "iam:roles:get": iamRolesGet,
  "iam:roles:create": iamRolesCreate,
  "iam:roles:update": iamRolesUpdate,
  "iam:roles:assign-permissions": iamRolesAssignPermissions,
  "iam:roles:assignable": iamRolesAssignable,
  "iam:permissions:list": iamPermissionsList,
  "iam:permissions:get": iamPermissionsGet,
  "iam:permissions:create": iamPermissionsCreate,
  "iam:permissions:update": iamPermissionsUpdate,
  "iam:permissions:by-severity": iamPermissionsBySeverity,
  "iam:resources:groups": iamResourcesGroups,
  "iam:resources:features": iamResourcesFeatures,
  "iam:organizations:list": iamOrganizationsList,
  "iam:organizations:get": iamOrganizationsGet,
  "iam:organizations:create": iamOrganizationsCreate,
  "iam:organizations:update": iamOrganizationsUpdate,
  "iam:organizations:my": iamOrganizationsMy,
  "iam:organizations:config:get": iamOrganizationsConfigGet,
  "iam:organizations:config:save": iamOrganizationsConfigSave,
  "iam:signup-settings:get": iamSignupSettingsGet,
  "iam:signup-settings:save": iamSignupSettingsSave,
  "mfa:config:get": mfaConfigGet,
  "mfa:config:save": mfaConfigSave,
  "mfa:totp:setup": mfaTotpSetup,
  "mfa:totp:verify-setup": mfaTotpVerifySetup,
  "mfa:totp:enable": mfaTotpEnable,
  "mfa:generate": mfaGenerate,
  "mfa:resend": mfaResend,
  "mfa:verify": mfaVerify,
  "mfa:method:set": mfaMethodSet,
  "mfa:disable": mfaDisable,
  "mfa:backup-codes:list": mfaBackupCodesList,
  "mfa:backup-codes:generate": mfaBackupCodesGenerate,
  "mfa:backup-codes:use": mfaBackupCodesUse,
  "mail:config:list": mailConfigList,
  "mail:config:get": mailConfigGet,
  "mail:config:save": mailConfigSave,
  "mail:config:delete": mailConfigDelete,
  "mail:config:duplicate": mailConfigDuplicate,
  "mail:template:list": mailTemplateList,
  "mail:template:get": mailTemplateGet,
  "mail:template:save": mailTemplateSave,
  "mail:template:delete": mailTemplateDelete,
  "mail:template:clone": mailTemplateClone,
  "mail:mailbox:list": mailMailboxList,
  "mail:mailbox:get": mailMailboxGet,
  "mail:send": mailSend,
  "mail:sendtoany": mailSendToAny,
  "notification:list": notificationList,
  "notification:get": notificationGet,
  "notification:save": notificationSave,
  "notification:delete": notificationDelete,
  "notifier:notify": notifierNotify,
  "notifier:list": notifierList,
  "notifier:unread": notifierUnread,
  "notifier:mark-read": notifierMarkRead,
  "notifier:mark-all-read": notifierMarkAllRead,
  "secrets:get": secretsGet,
  "secrets:save": secretsSave,
  "storage:config:list": storageConfigList,
  "storage:config:get": storageConfigGet,
  "storage:config:save": storageConfigSave,
  "storage:config:delete": storageConfigDelete,
  "auth:idp:list": authIdpList,
  "auth:idp:get": authIdpGet,
  "auth:idp:create": authIdpCreate,
  "auth:idp:update": authIdpUpdate,
  "auth:idp:delete": authIdpDelete,
  "auth:idp:status": authIdpStatus,
  "auth:config:get": authConfigGet,
  "auth:config:save": authConfigSave,
  "auth:client-credentials:list": authClientCredentialsList,
  "auth:client-credentials:save": authClientCredentialsSave,
  "auth:client-credentials:delete": authClientCredentialsDelete,
  "auth:oidc-clients:list": authOidcClientsList,
  "auth:oidc-clients:get": authOidcClientsGet,
  "auth:oidc-clients:save": authOidcClientsSave,
  "auth:oidc-clients:delete": authOidcClientsDelete,
  "auth:oidc-clients:rotate-secret": authOidcClientsRotateSecret,
  "auth:remove": authRemove,
  "iam:me": iamMe,
  "projects:get": getProject,
  "new:web": newWeb,
  "skill:list": skillList,
  "skill:show": skillShow,
  "skill:add": skillAdd,
  "sdk:client": sdkClient,
};

const MAX_COMMAND_WORDS = 4;

function resolveCommand(argv: string[]): { handler: CommandHandler; args: string[] } | null {
  const words: string[] = [];
  let tokensConsumed = 0;

  for (const token of argv) {
    if (token.startsWith("-")) break;

    words.push(...token.split(":").filter(Boolean));
    tokensConsumed++;

    const handler = commands[words.join(":")];
    if (handler) return { handler, args: argv.slice(tokensConsumed) };
    if (words.length >= MAX_COMMAND_WORDS) break;
  }

  return null;
}

const argv = process.argv.slice(2);
const [command, subcommand] = argv;

try {
  if (command === "--version" || command === "-v" || command === "version") {
    await printVersion();
  } else if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
  } else {
    const resolved = resolveCommand(argv);
    if (!resolved) {
      throw new Error(`Unknown command: ${[command, subcommand].filter(Boolean).join(" ")}`);
    }
    await resolved.handler(resolved.args);
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

  if (message.includes("is not logged in") || message.includes("Run 'blocks login' first")) {
    return {
      code: "not_logged_in",
      message,
      nextStep: "blocks login, then blocks projects list, then blocks use <tenantId>"
    };
  }

  if (message.includes("token expired") || message.includes("refresh token") || message.includes("cannot decrypt")) {
    return { code: "auth_repair_required", message, nextStep: "blocks login" };
  }

  if (message.includes("No project selected")) {
    return {
      code: "project_not_selected",
      message,
      nextStep: "blocks projects list, then blocks use <tenantId>"
    };
  }

  if (message.startsWith("Blocks API 401") || message.startsWith("Blocks API 403")) {
    return { code: "api_auth_failed", message, nextStep: "blocks auth status && blocks login" };
  }

  return { code: "command_failed", message };
}

function printHelp(): void {
  console.log(`Blocks CLI

Usage:
  blocks <command> [options]

  Namespaced commands use spaces, e.g. 'blocks data schema list'.
  ':' also works if you prefer it: 'blocks data:schema:list'.

Global options:
  --version                 Print CLI version.
  --json                    Print machine-readable JSON where supported.
  --api-url <url>           Override Blocks API URL for this command.
  --account <name>          Use a named account profile; default is implicit.
  --project <tenantId>      Use a project tenant for project-scoped commands.
  --dry-run                 Show planned mutation without calling the API.
  --yes                     Skip mutation confirmation after explicit approval.

Setup and health:
  blocks init
    Create local Blocks workspace files: blocks.json, data schema/rules folders,
    and .env.example.

  blocks doctor [--json]
    Check local Node.js, OIDC config, token cache, selected project, and config
    file locations. Does not mutate cloud resources.

Auth:
  blocks login
    Device-code login. Prints a verification URL and user code, opens the
    browser to the verification page when possible so you only need to click
    approve, then polls until the device is authorized; stores account access
    and refresh tokens and auto-refreshes later. If a project was previously
    selected, re-impersonates it automatically; otherwise lists projects and
    prompts you to run 'blocks use <tenantId>'.

  blocks auth status [--json]
    Show only whether account/project access and refresh tokens are missing,
    valid, expired, or available. Does not print account config values.

  blocks auth refresh [--project] [--json]
    Force account token refresh, or project token refresh with --project.

  blocks auth remove <account>
    Clear cached tokens and stored local credentials for that account. The
    packaged default OS account is restored from package defaults.

  blocks logout
    Revoke the current refresh token when possible and remove local session data.

Projects:
  blocks projects list [--json]
    List accessible Blocks projects via /os/v4/Project/Gets. Uses the
    impersonated project session when a project is selected, otherwise the
    account token. Read-only.

  blocks projects get [tenantId] [--deployment] [--json]
    Read one project from Project/Gets. Uses selected project when tenantId is
    omitted. Pass --deployment to also include the environment, tenantGroupId,
    and linked repo assets (from Project/GetAsset) that 'release deploy' uses
    to resolve its target. Read-only.

  blocks use <project-tenant-id>
    Save the selected project tenant globally and in blocks.json when present,
    then immediately impersonate it. If a different project was selected,
    stops that impersonation first to reclaim a fresh account refresh token
    before starting the new one.

  blocks deselect
    Stop the active impersonation (restoring a fresh account refresh token),
    then clear the selected project tenant (globally and in blocks.json) and
    drop its cached impersonation token. Run 'blocks use <tenantId>' again to
    reselect and re-impersonate.

IAM:
  blocks iam me [--json]
    Read the current user from IAM (bootstrapping/CLI operator identity, not
    a project resource). Uses the impersonated project session when a project
    is selected, otherwise the account token -- the server always resolves
    this to the root identity either way. Every other iam * command below is
    project-scoped: it requires a selected project and calls IAM using an
    impersonated project token only, never the account token.

  Users (/iam/v4/iam/users*):
    blocks iam users list [--page 1] [--page-size 20] [--email <e>] [--name <n>]
                              [--organization-id <id>] [--sort-by <field>] [--sort-desc]
                              [--filter '<json>'] [--json]
      Query users. --filter merges a raw JSON filter object over the convenience flags.
    blocks iam users get <id> [--organization-id <id>] [--json]
    blocks iam users create --email <e>|--user-name <n> [--first-name] [--last-name]
                                [--password] [--phone-number] [--organization-id]
                                [--roles a,b] [--permissions a,b] [--body '<json>'|--file <path>]
                                [--dry-run] [--yes] [--json]
    blocks iam users update <id> [--first-name] [--last-name] [--phone-number]
                                [--organization-id] [--roles a,b] [--permissions a,b]
                                [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks iam users activate <userId> [--reason <text>] [--dry-run] [--yes] [--json]
    blocks iam users deactivate <userId> [--dry-run] [--yes] [--json]
    blocks iam users access grant <userId> [--roles a,b] [--permissions a,b]
                                [--organization-id] [--dry-run] [--yes] [--json]
    blocks iam users access revoke <userId> [--organization-id] [--dry-run] [--yes] [--json]
    blocks iam users exists <email> [--json]
    blocks iam email available <email> [--json]

  Roles (/iam/v4/iam/roles*):
    blocks iam roles list [--page] [--page-size] [--search] [--slugs a,b]
                              [--organization-id] [--filter '<json>'] [--json]
    blocks iam roles get <id> [--json]
    blocks iam roles create --name <n> [--slug] [--description] [--parent-role-slug]
                              [--can-create-own] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks iam roles update <itemId> [--name] [--description] [--parent-role-slug]
                              [--propagate-to-other-org] [--can-create-own]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks iam roles assign-permissions <slug> [--add-permissions a,b]
                              [--remove-permissions a,b] [--organization-id]
                              [--dry-run] [--yes] [--json]
    blocks iam roles assignable [--json]

  Permissions (/iam/v4/iam/permissions*):
    blocks iam permissions list [--page] [--page-size] [--search] [--type <0-3>]
                              [--severity <0-4>] [--resource-group] [--tags a,b]
                              [--resources a,b] [--is-built-in] [--is-archived]
                              [--roles a,b] [--organization-id] [--filter '<json>'] [--json]
    blocks iam permissions get <id> [--json]
    blocks iam permissions create --name <n> [--type] [--description] [--resource]
                              [--resource-group] [--tags a,b] [--severity] [--is-built-in]
                              [--dependent-permissions a,b] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks iam permissions update <id> [same flags as create, plus --is-archived]
                              [--dry-run] [--yes] [--json]
    blocks iam permissions by-severity [--json]

  Resources (/iam/v4/iam/resource*):
    blocks iam resources groups [--json]
    blocks iam resources features [--search <text>] [--is-built-in] [--json]

  Organizations (/iam/v4/iam/organizations*):
    blocks iam organizations list [--page] [--page-size] [--search] [--ids a,b]
                              [--is-disabled] [--parent-organization-id] [--json]
    blocks iam organizations get <id> [--json]
    blocks iam organizations create --name <n> [--description] [--email] [--phone-number]
                              [--website-url] [--default-roles a,b] [--default-permissions a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks iam organizations update <id> [--name] [--description] [--email]
                              [--phone-number] [--website-url] [--industry] [--time-zone]
                              [--currency] [--locale] [--is-enabled]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks iam organizations my [--json]
    blocks iam organizations config get [--json]
    blocks iam organizations config save [--allow-org-creation-from-cloud]
                              [--allow-org-creation-from-construct] [--allow-org-creation-from-signup]
                              [--allow-org-creation-from-portal] [--multi-org-enabled]
                              [--consent-for-multi-org-enable] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]

  Signup settings (/iam/v4/iam/signup-settings):
    blocks iam signup-settings get [--json]
    blocks iam signup-settings save [--email-password-signup] [--sso-signup]
                              [--default-roles a,b] [--default-permissions a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

MFA (/iam/v4/mfa*, project-scoped: requires a selected project, impersonated project token only):
  blocks mfa config get [--json]
    Read the tenant's MFA policy.
  blocks mfa config save [--enable] [--require-for-all-users] [--allow-user-opt-out]
                              [--allow-backup-codes] [--backup-codes-count <n>]
                              [--user-mfa-type 0,1] [--required-roles a,b] [--exempt-roles a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Save the tenant's MFA policy.
  blocks mfa totp setup [--json]
    Start TOTP enrollment for the impersonated user.
  blocks mfa totp verify-setup <code> [--json]
    Confirm TOTP enrollment.
  blocks mfa totp enable --mfa-type <n> [--code <c>] [--dry-run] [--yes] [--json]
    Composed enrollment: totp setup -> (scan the printed QR/secret, enter the code --
    interactively prompted if --code is omitted) -> totp verify-setup -> method set
    --mfa-type <n> -> backup-codes generate. One sitting, one confirmation.
    --mfa-type is required and not defaulted: the numeric value meaning "TOTP" is
    tenant-defined and undocumented here (same value plain mfa method set expects) --
    look it up rather than guessing.
  blocks mfa generate --mfa-type <n> [--send-phone-number-as-email-domain <domain>] [--json]
    Send an OTP challenge; returns an mfaId to pass to resend/verify.
  blocks mfa resend <mfaId> [--send-phone-number-as-email-domain <domain>] [--json]
  blocks mfa verify <mfaId> <code> --auth-type <n> [--from-token-call] [--json]
  blocks mfa method set --mfa-type <n> [--json]
    Switch the impersonated user's active MFA method.
  blocks mfa disable [--dry-run] [--yes] [--json]
  blocks mfa backup-codes list [--json]
  blocks mfa backup-codes generate [--dry-run] [--yes] [--json]
  blocks mfa backup-codes use <userId> <code> [--json]

Mail (/os/v4/Mail/* — project-scoped: requires a selected project, impersonated project token only):
  blocks mail config list [--json]
    List SMTP/inbound mail configurations for the selected project.
  blocks mail config get <name> [--json]
  blocks mail config save [--configuration-id <id>] [--name <n>] [--host <h>] [--port <n>]
                              [--enable-ssl] [--sender-name] [--sender-address] [--sender-username]
                              [--account-password] [--inbound] [--provider <0|1>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --configuration-id to create; pass it to update.
  blocks mail config delete <configurationId> [--dry-run] [--yes] [--json]
  blocks mail config duplicate <configurationId> [--dry-run] [--yes] [--json]
  blocks mail template list [--page-number] [--page-size] [--search] [--sort-by] [--sort-desc]
                              [--configuration-id] [--language] [--json]
  blocks mail template get <itemId> [--json]
  blocks mail template save [--item-id <id>] [--configuration-id] [--name] [--language]
                              [--subject] [--template-body] [--json-content] [--image-id]
                              [--image-url] [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to create; pass it to update.
  blocks mail template delete <itemId> [--dry-run] [--yes] [--json]
  blocks mail template clone <itemId> [--configuration-id] [--language] [--name] [--subject]
                              [--dry-run] [--yes] [--json]
  blocks mail mailbox list [--page-number] [--page-size] [--status] [--search]
                              [--start-date] [--end-date] [--inbound] [--json]
  blocks mail mailbox get <messageId> [--json]
  blocks mail send [--to a,b] [--cc a,b] [--bcc a,b] [--reply-to a,b] [--purpose <p>]
                              [--language <culture>] [--subject-data-context '<json>']
                              [--body-data-context '<json>'] [--attachments '<json>']
                              [--send-phone-number-as-email] [--project-key <key>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Send an email through the tenant's default mail configuration
    (/logic/v4/Mail/Send). --project-key defaults to the selected project.
  blocks mail sendtoany [same flags as mail send, plus --is-test-mail]
                              [--dry-run] [--yes] [--json]
    Same as mail send but via /logic/v4/Mail/SendToAny, which lets the mail
    provider route the send (e.g. mark it --is-test-mail).

Notification (/os/v4/Notification/* — project-scoped: requires a selected project, impersonated project token only):
  blocks notification list [--page] [--page-size] [--sort-by] [--sort-desc] [--filter] [--json]
  blocks notification get <itemId> [--json]
  blocks notification save [--name <n>] [--channel <0|1>] [--type <0-3>] [--enable-persistence]
                              [--notify-method] [--update] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    Pass --update when saving over an existing notification configuration.
  blocks notification delete <itemId> [--dry-run] [--yes] [--json]

Notifier (/logic/v4/Notifier/* — real-time/offline notification sends and inbox reads;
          project-scoped: requires a selected project, impersonated project token only.
          Distinct from 'notification' above, which manages notification channel
          configuration, not sending):
  blocks notifier notify [--user-ids a,b] [--roles a,b] [--connection-id <id>]
                              [--subscription-filters '<json>'] [--denormalized-payload <text>]
                              [--save-denormalized-payload-as-object] [--response-key]
                              [--response-value] [--content-available] [--configuration-name]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Push a notification to specific users/roles, or everyone matching a subscription
    filter. Target with at least one of --user-ids/--roles/--subscription-filters.
  blocks notifier list [--unread-only] [--page] [--page-size] [--sort-by] [--sort-desc]
                              [--filter] [--json]
    List the signed-in user's notifications (GetNotifications). Read-only.
  blocks notifier unread [--user-id <id>] [--context <c>] [--action-name <a>] [--value <v>]
                              [--order-by <1|2>] [--json]
    Read unread notifications matching a subscription filter. Sent as query
    parameters even though swagger documents this endpoint as GET with a JSON
    body -- the Fetch spec forbids a body on GET. Read-only.
  blocks notifier mark-read <id> [--dry-run] [--yes] [--json]
  blocks notifier mark-all-read [--dry-run] [--yes] [--json]

Secrets (/os/v4/Secrets/* — project-scoped: requires a selected project, impersonated project
          token only; generic tenant secret storage, e.g. captcha provider config):
  blocks secrets get <secretKey> [--page-number 0] [--page-size 10] [--json]
  blocks secrets save --secret-key <key> [--item-id <id>] --key-value-pairs '<json>'
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to create, pass it to update. --key-value-pairs is a flat
    JSON object of provider-specific fields, e.g.
    --key-value-pairs '{"isEnable":"true","provider":"recaptcha","captchaKey":"...","captchaSecret":"..."}'.

Storage (/os/v4/Storage/* — project-scoped: requires a selected project, impersonated project token only):
  blocks storage config list [--json]
  blocks storage config get <name> [--json]
  blocks storage config save [--item-id <id>] [--name <n>] [--strategy] [--connection-string]
                              [--secret-key] [--access-key] [--region-endpoint] [--host] [--port]
                              [--username] [--password] [--remote-base-path] [--update]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Upsert: omit --item-id to create; pass --update to update.
  blocks storage config delete <name> [--dry-run] [--yes] [--json]

Auth Admin (/iam/v4/auth/identity-providers*, /config, /client-credentials, /oidc-clients —
            project-scoped: requires a selected project, impersonated project token only):
  blocks auth idp list [--json]
  blocks auth idp get <id> [--json]
  blocks auth idp create --provider <p> --provider-type <t> --protocol <proto>
                              --client-id <id> [--client-secret] [--display-name] [--issuer]
                              [--scope] [--redirect-uris a,b] [--active]
                              [--authorization-url] [--token-url] [--user-info-url]
                              [--jwks-uri] [--well-known-url] [--response-type]
                              [--grant-types a,b] [--require-pkce]
                              [--token-endpoint-auth-method] [--initial-roles a,b]
                              [--initial-permissions a,b] [--icon]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Apple-specific fields (teamId, keyId, privateKey, appleAudience) go in --body/--file
    so no private key lands in shell history.
    IAM's create endpoint stores issuer/jwksUri/wellKnownUrl but drops
    authorizationUrl/tokenUrl/userInfoUrl -- set those with 'idp update' afterward.
  blocks auth idp update <id> [same flags as create, all optional] [--dry-run] [--yes] [--json]
    provider/providerType/protocol/clientId are immutable: omit them, or echo the
    existing values exactly if you also pass --body/--file.
    The only endpoint that persists authorizationUrl/tokenUrl/userInfoUrl -- create accepts
    and drops them, and update never re-runs discovery, so values set here stick. Use it to
    repair a provider whose authorizationUrl came back null: '/idp/initiate' builds its
    redirect from that field, so hosted login goes nowhere without it. Read the endpoint
    values from the tenant's discovery document rather than composing them by hand.
  blocks auth idp delete <id> [--dry-run] [--yes] [--json]
    Irreversible; also deletes the related OIDC client registration.
  blocks auth idp status <id> --active|--active=false [--dry-run] [--yes] [--json]
    Enable/disable a provider without deleting its configuration.
  blocks auth config get [--json]
  blocks auth config save [--refresh-token-minutes] [--absolute-refresh-token-minutes]
                              [--access-token-minutes] [--remember-me-refresh-token-minutes]
                              [--wrong-attempts-to-lock] [--account-lock-duration-minutes]
                              [--oidc-enabled] [--logout-on-password-change]
                              [--password-strength-regex] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
  blocks auth client-credentials list [--json]
    clientSecret is included in list responses; treat CLI output as sensitive.
  blocks auth client-credentials save --name <n> [--item-id <id>] [--roles a,b]
                              [--permissions a,b] [--access-token-valid-minutes] [--active]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    Omit --item-id to create; pass it to update. The response's clientSecret is
    shown once and is not retrievable again afterward.
  blocks auth client-credentials delete <id> [--dry-run] [--yes] [--json]

  blocks auth oidc-clients list [--json]
    List registered OAuth 2.0 / OIDC client applications for the tenant. client_secret
    is excluded from list/get responses.
  blocks auth oidc-clients get <clientId> [--json]
  blocks auth oidc-clients save [--item-id <id>] [--client-display-name] [--client-type]
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
    --client-type is not optional in practice: IAM derives tokenEndpointAuthMethod from it,
    so omitting it stores a browser/SPA client as confidential ("client_secret_post") and
    lets it request the client_credentials grant. Pass --client-type public for any
    PKCE/browser client.
    --register-as-identity-provider creates the linked identity provider in the same call.
    Its authorize/token/userinfo/jwks/issuer values are filled from the discovery document
    at --external-discovery-endpoint; with no discovery endpoint they are left null and the
    provider's scope is replaced with "openid profile email". Verify with 'auth idp list'.
  blocks auth oidc-clients delete <clientId> [--dry-run] [--yes] [--json]
    Irreversible; revokes all tokens issued to the client.
  blocks auth oidc-clients rotate-secret <clientId> [--dry-run] [--yes] [--json]
    Generates a new client_secret, shown once; the old secret stops working immediately.

Data:
  blocks data validate [--json]
    Validate local blocks/data/schemas/*.json and blocks/data/rules.json before
    pushing. Local-only.

  blocks data schema list [--json]
    List project schemas via /data/v4/schemas using an impersonated project
    token. Read-only.

  blocks data schema pull [--json]
    Download project schemas into blocks/data/schemas/*.json. Writes local files
    only.

  blocks data schema push [--dry-run] [--yes] [--json]
    Create or update project schemas via /data/v4/schemas/define. Mutating;
    uses POST for create and PUT for update.

  blocks data rules pull [--json]
    Download data-access policies into blocks/data/rules.json. Writes local
    files only.

  blocks data rules deploy [--dry-run] [--yes] [--json]
    Apply schema security and data-access policies. Mutating; supports dry-run
    and confirmation.

  blocks data reload [--dry-run] [--yes] [--json]
    Reload Data schema configuration so staged schema/rule changes become live.
    Mutating; calls POST /data/v4/schema-configurations/reload.

  blocks data sync [--dry-run] [--yes] [--json]
    Composed flow: validate local schemas/rules, then data schema push ->
    data rules deploy -> data reload, so pushed changes actually go live in one
    step. Validation runs first and hard-fails before anything is sent if it
    finds errors. Prints 3 separate step outputs (one per underlying command),
    not one combined document. One confirmation covers the whole flow.

  Data source configuration (/data/v4/configurations) - check this first; by default a
  project's Data Gateway runs on Blocks-managed storage and data config get is all you need.
  Only create/update a configuration if you're pointing the gateway at your own database.
    blocks data config get [--json]
    blocks data config create --connection-string <cs> [--database-name <name>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks data config update --item-id <id> [--connection-string] [--database-name]
                              [--collection-name-editable] [--collection-name-pattern]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

  Raw Schema API (/data/v4/schemas* - beyond the file-oriented list/pull/push above):
    blocks data schema get <id> [--json]
    blocks data schema get-by-name <schemaName> [--json]
      Full field-level detail by collection name (info-by-name).
    blocks data schema aggregation [--keyword] [--schema-name] [--collection-name]
                              [--schema-type <1|2>] [--page] [--page-size] [--sort-by]
                              [--sort-desc] [--json]
      Schemas plus an access-level summary (Public/User/Custom x Read/Write/Edit/Delete).
    blocks data schema change-logs [--json]
      Unadapted schema change logs; data reload clears these.
    blocks data schema delete <id> [--dry-run] [--yes] [--json]
      Irreversible.
    blocks data schema info list [--json]
      Entity-type schema collections with basic info.
    blocks data schema info save --schema-name <n> [--collection-name] [--schema-type <1|2>]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
      Create schema metadata only (no fields yet) - pair with data schema fields.
    blocks data schema info update --item-id <id> [--schema-name] [--collection-name]
                              [--schema-type <1|2>] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks data schema fields --schema-id <schemaDefinitionItemId> [--deletable-fields a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
      Add/update field definitions; the 'fields' array (name/type/isArray/isPIIData/
      isUniqueData/description) goes in --body/--file, e.g.
      --body '{"fields":[{"name":"email","type":"string"}]}'.

  Data-access policies, single-item ops (beyond the file-oriented rules pull/deploy above):
    blocks data rules policy get <schemaName> [--json]
    blocks data rules policy delete <itemId> [--dry-run] [--yes] [--json]

  Data validation (/data/v4/data-validations* - field-level validation rules; no file-oriented
                    workflow exists for this yet, use these directly):
    blocks data validation list [--schema-id] [--field-name] [--keyword] [--page]
                              [--page-size] [--sort-by] [--sort-desc] [--json]
    blocks data validation get <validationId> [--json]
    blocks data validation by-schema <schemaId> [--json]
    blocks data validation by-schema-field <schemaId> <fieldName> [--json]
    blocks data validation save --schema-id <id> --field-name <name> [--item-id]
                              --body '<json>' (must include a "validations" array, e.g.
                              '{"validations":[{"type":1,"value":"^[0-9]+$","isActive":true}]}')
                              [--dry-run] [--yes] [--json]
      Upsert: omit --item-id to create, pass it to update.
    blocks data validation delete <validationId> [--dry-run] [--yes] [--json]

  Storage object tree (files, directories, discovery, trash, versions, and access):
    blocks data files get <fileId> [--version] [--configuration-name] [--json]
    blocks data files get-many <fileId...>|--file-ids a,b [--configuration-name] [--json]
    blocks data files info [--name] [--tenant-id] [--page] [--page-size] [--sort-by]
                              [--sort-desc] [--json]
    blocks data files upload --file <localPath> [--name] [--item-id] [--parent-id] [--tags]
                              [--access-modifier Public|Private] [--content-type]
                              [--configuration-name] [--module-name <1-11>] [--local-storage]
                              [--dry-run] [--yes] [--json]
      Cloud: create file/version metadata, then PUT bytes to the returned URL. Local:
      one multipart request. The file appears in the object tree without registration.
    blocks data files presigned-upload-url --name <fileName> [--item-id] [--parent-directory-id]
                              [--access-modifier Public|Private] [--configuration-name]
                              [--module-name <1-11>] [--meta-data] [--tags]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
      Mutating cloud step 1: creates metadata/version and returns uploadUrl/fileId.
    blocks data files upload-to-url --url <presignedUrl> --file <localPath>
                              --content-type <type> [--blob-type BlockBlob] [--no-blob-type-header]
                              [--dry-run] [--yes] [--json]
      Step 2. Provider-direct PUT - no Blocks auth headers by design.
    blocks data files upload-to-local-storage --file <localPath> [--name] [--item-id]
                              [--parent-directory-id] [--tags] [--access-modifier Public|Private]
                              [--configuration-name] [--meta-data] [--additional-properties '<json>']
                              [--dry-run] [--yes] [--json]
      One-call alternative to the two commands above, for local-storage-backed projects.
    blocks data files update-additional-info <itemId> --additional-properties '<json>'
                              [--dry-run] [--yes] [--json]
    blocks data files delete <fileId> [--configuration-name] [--event-queue-name]
                              [--permanent]
                              [--dry-run] [--yes] [--json]
      Defaults to moving the file to trash; --permanent removes bytes and metadata.
    blocks data files list [--parent-id] [--module-name <1-11>] [--type directory|file]
                              [--search] [--cursor] [--limit 1-200] [--json]
    blocks data files search <query> [--directory-id] [--type directory|file]
                              [--cursor] [--limit 1-200] [--json]
    blocks data files trash|shared [--type directory|file] [--cursor] [--limit] [--json]
    blocks data files restore <resourceId> [--dry-run] [--yes] [--json]
    blocks data files purge <resourceId> [--dry-run] [--yes] [--json]
    blocks data files directory-create <name> [--parent-id] [--module-name]
                              [--description] [--allowed-extensions pdf,docx]
                              [--dry-run] [--yes] [--json]
    blocks data files directory-get <directoryId> [--json]
    blocks data files directory-update <directoryId> [--name] [--description]
                              [--dry-run] [--yes] [--json]
    blocks data files directory-delete <directoryId> [--permanent]
                              [--dry-run] [--yes] [--json]
    blocks data files directory-move <directoryId> [--target-directory-id]
                              [--dry-run] [--yes] [--json]
    blocks data files versions <fileId> [--cursor] [--limit 1-100] [--json]
    blocks data files create-version <fileId> [--configuration-name]
                              [--dry-run] [--yes] [--json]
    blocks data files copy <fileId> --target-directory-id <id> [--copy-access-policies]
                              [--dry-run] [--yes] [--json]
    blocks data files move <fileId> --target-directory-id <id> [--dry-run] [--yes] [--json]
    blocks data files rename <fileId> --name <name> [--dry-run] [--yes] [--json]
    blocks data files access-list|access-resolve <resourceId> [--json]
    blocks data files access-grant <resourceId> --resource-type Directory|File
                              --principal-type User|Role|Everyone|Organization
                              [--principal-id] --permission View|Download|Edit|Delete|Manage|Owner
                              [--effect Allow|Deny] [--priority] [--expires-at]
                              [--dry-run] [--yes] [--json]
    blocks data files access-update <resourceId> --policy-id <id> <same policy flags>
    blocks data files access-revoke <resourceId> --policy-id <id> [--dry-run] [--yes] [--json]
    blocks data files inheritance <resourceId> --enabled=true|false [--dry-run] [--yes] [--json]
    blocks data files share <resourceId> --resource-type <type> --principal-type <type>
                              [--principal-id] --permission <permission> [--expires-at]
                              [--dry-run] [--yes] [--json]

Localization:
  blocks localization validate --module <name> --language <culture> [--file <path>] [--json]
    Validate a local i18n JSON dictionary. Supports nested JSON input and
    validates the flattened key/value set locally.

  blocks localization push --module <name> --language <culture> [--file <path>] [--route <route>] [--context <text>] [--dry-run] [--yes] [--json]
    Create or update Localization keys from a local i18n JSON dictionary via
    /localization/v4/Key/SaveKeys. Creates the module first when it is missing.

  blocks localization pull --module <name> --language <culture> [--out <path>] [--json]
    Download published cloud localization via
    /localization/v4/Key/GetCloudUilmFile and write a local JSON dictionary.

  Raw API (/localization/v4/* — project-scoped: requires a selected project, impersonated
            project token only). These call the Localization service endpoints directly,
            in addition to the file-oriented validate/push/pull commands above.

    blocks localization assistant translation-suggestion --source-text <text>
                              --destination-language <culture> [--current-language]
                              [--element-type] [--element-application-context]
                              [--element-detail-context] [--temperature] [--max-character-length]
                              [--glossary-ids a,b] [--module-id] [--destination-language-code]
                              [--body '<json>'|--file <path>] [--json]

    blocks localization config get-webhook [--json]
    blocks localization config save-webhook --url <url> --content-type <type>
                              --secret <s> --header-key <k> [--item-id <id>] [--is-disabled]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]

    blocks localization glossary save --name <n> [--item-id] [--language] [--type]
                              [--context] [--additional-note] [--is-global] [--module-ids a,b]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks localization glossary list [--search] [--page-number] [--page-size]
                              [--is-global] [--module-id] [--json]
    blocks localization glossary get <itemId> [--json]
    blocks localization glossary suggested <itemId> [--max-results <n>] [--json]
    blocks localization glossary delete <itemId> [--dry-run] [--yes] [--json]

    blocks localization key save --key-name <n> --module-id <id> [--item-id] [--value]
                              [--culture] [--routes a,b] [--glossary-ids a,b] [--context]
                              [--is-new-key] [--is-partially-translated] [--should-publish]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks localization key list [--key-search-text] [--search-key] [--module-ids a,b]
                              [--page-number] [--page-size] [--sort-by] [--sort-desc]
                              [--is-partially-translated] [--missing-languages a,b]
                              [--create-date-start] [--create-date-end]
                              [--last-update-date-start] [--last-update-date-end]
                              [--glossary-id] [--body '<json>'|--file <path>] [--json]
    blocks localization key get-by-names <keyName...>|--key-names a,b [--module-id] [--json]
    blocks localization key get <itemId> [--json]
    blocks localization key delete <itemId> [--dry-run] [--yes] [--json]
    blocks localization key delete-keys <itemId...>|--item-ids a,b [--dry-run] [--yes] [--json]
    blocks localization key get-timeline [--entity-id] [--user-id] [--page-number]
                              [--page-size] [--sort-by] [--sort-desc] [--create-date-start]
                              [--create-date-end] [--json]
    blocks localization key get-localization-timeline [--user-id] [--log-from]
                              [--log-from-values a,b] [--exclude-log-from-values a,b]
                              [--page-number] [--page-size] [--sort-by] [--sort-desc]
                              [--create-date-start] [--create-date-end] [--json]
    blocks localization key get-timeline-by-operation-id <operationId> [--page-number]
                              [--page-size] [--json]
    blocks localization key get-uilm-file --module <name> --language <culture> [--json]
    blocks localization key generate-uilm-file --module-id <id> [--guid]
                              [--dry-run] [--yes] [--json]
    blocks localization key translate-all --module-id <id> [--default-language]
                              [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks localization key translate-key <keyId> --default-language <culture>
                              [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks localization key translate-keys <keyId...>|--key-ids a,b --default-language <culture>
                              [--message-co-relation-id] [--project-key]
                              [--dry-run] [--yes] [--json]
    blocks localization key translate-and-export --module-id <id> [--default-language]
                              [--wait] [--poll-interval <seconds>] [--timeout <seconds>]
                              [--guid] [--output-type <0-5>] [--app-ids a,b] [--languages a,b]
                              [--reference-file-id] [--caller-tenant-id] [--start-date]
                              [--end-date] [--dry-run] [--yes] [--json]
      Composed flow: translate-all -> generate-uilm-file -> uilm-export. Without --wait,
      fires all 3 back to back (same as running them by hand). With --wait, polls
      GetTimelineByOperationId (using a generated messageCoRelationId) between translate
      and generate, since translation runs async and there's no documented explicit
      "done" field to check -- it stops once the timeline entry count settles across 2
      polls, or times out with a clear next-step message. Prints one output block per
      step, not a single combined document.
    blocks localization key uilm-import <fileId> [--message-co-relation-id]
                              [--dry-run] [--yes] [--json]
    blocks localization key uilm-export [--output-type <0-5>] [--app-ids a,b] [--languages a,b]
                              [--reference-file-id] [--caller-tenant-id] [--start-date]
                              [--end-date] [--message-co-relation-id] [--dry-run] [--yes] [--json]
    blocks localization key get-uilm-exported-files [--search] [--page-number] [--page-size]
                              [--create-date-start] [--create-date-end] [--json]
    blocks localization key get-language-file-generation-history [--page-number]
                              [--page-size] [--json]
    blocks localization key rollback <itemId> [--dry-run] [--yes] [--json]

    blocks localization language save --language-name <n> --language-code <c> [--item-id]
                              [--is-default] [--body '<json>'|--file <path>]
                              [--dry-run] [--yes] [--json]
    blocks localization language list [--json]
    blocks localization language list-for-tenant [--json]
    blocks localization language delete <languageName> [--dry-run] [--yes] [--json]
    blocks localization language set-default <languageName> [--dry-run] [--yes] [--json]

    blocks localization module save --module-name <n> [--item-id]
                              [--body '<json>'|--file <path>] [--dry-run] [--yes] [--json]
    blocks localization module list [--json]
    blocks localization module list-for-tenant [--json]
    blocks localization module tag-glossary <moduleId> --glossary-ids a,b
                              [--dry-run] [--yes] [--json]

Release:
  blocks release deploy [--domain <customDomain>] [--wait] [--poll-interval <seconds>]
                    [--timeout <seconds>] [--dry-run] [--yes] [--json]
    Deploy the selected project's environment. Resolves everything from state
    you already have: the repo linked to this project (Project/GetAsset) and
    that repo's connected branch (Build/repo-details) -- no --repo-id needed.
    Aborts if the connected branch doesn't match this environment's name.
    Pass --domain to also set the custom deployment domain before deploying.
    Pass --wait to poll release status on the resulting build until it reaches
    a terminal state (or --timeout elapses, default 900s) instead of returning
    immediately with just a build id.
    Mutating; no artifact upload is performed by this CLI.

  blocks release status <buildId> [--json]
    Read Release build status by build id using an impersonated project
    token. Read-only.

  blocks release builds list [repoId] [--repo-id <repoId>] [--json]
    List Release build details for a repository using an impersonated project
    token. When repoId is omitted, resolves it from the selected project's
    linked repo assets (Project/GetAsset, account token) -- auto-picked if
    there's exactly one, otherwise you're prompted to choose. Read-only.

  blocks release builds get <buildId> [--json]
    Alias for release status. Read-only.

Scaffold:
  blocks new web <name> [--app-domain <domain>] [--client-id <oidcClientId>]
                    [--x-blocks-key <tenantId>] [--blocks-api-url <url>] [--oidc-url <url>]
    Create a Vite React starter app that talks to Blocks exclusively through
    @seliseblocks/client (a single createBlocksClient() instance) using the SDK
    hosted IdP flow: blocksClient.auth.idp.redirectToProvider() on login click
    and blocksClient.auth.idp.callback() on /login/callback. Includes route
    guards, auto-refresh through auth.oidc.refreshToken(), live
    auth/iam/data/localization SDK examples, environment config, and safe
    .gitignore defaults.
    Uses the selected project (see 'use') unless --x-blocks-key overrides it.
    --app-domain and --client-id are resolved from the project when omitted:
    if the project has one domain it's used automatically, otherwise you're
    prompted to choose; the OIDC client is picked from a list of the
    project's existing clients, or you can create a minimal one (display
    name + redirect URI, active, registered as a Blocks OIDC identity
    provider) on the spot, or skip and register one later from the portal or
    'auth oidc-clients save'.
    If --blocks-api-url is omitted, it is derived from the app domain:
    https://blocksapi.<registrable-domain> (for example, app domain
    https://dqrsf.slsblx.com uses https://blocksapi.slsblx.com). Pass a
    different Data/IAM/Localization/OS gateway URL explicitly only if your
    project uses a non-default one.
    --oidc-url defaults to https://iam.seliseblocks.com.

Skills:
  blocks skill list [--json]
    List bundled blocks-skills/*/SKILL.md agent context docs (name +
    description). Local-only, no cloud calls.
  blocks skill show <name> [--json]
    Print one skill's full SKILL.md content.
  blocks skill add <name> [--dir <path>]
    Copy a bundled skill's SKILL.md into <path>/<name>/SKILL.md in the
    current directory (default --dir is 'blocks-skills'), for use in a
    project outside this monorepo. Overwrites silently, same as
    'data schema pull'.

SDK:
  blocks sdk client [--app-domain <domain>] [--client-id <oidcClientId>]
                    [--x-blocks-key <tenantId>] [--blocks-api-url <url>] [--oidc-url <url>] [--json]
    Read-only: "I want to use the Blocks SDK -- show me the client." Resolves this
    project's @seliseblocks/client config using the selected project unless
    --x-blocks-key overrides it, and the project's registered domain/OIDC client
    when --app-domain/--client-id are omitted. Its API URL defaults to
    https://api.seliseblocks.com unless --blocks-api-url is passed.
    Prints a ready-to-paste createBlocksClient(...) snippet.
    Passing both --app-domain and --client-id skips the project lookup entirely
    (no login required). Never writes a file; to scaffold a new app use 'new web'.
`);
}
