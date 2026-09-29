// GENERATED FILE -- do not edit by hand.
// Run: node scripts/generate-command-catalog.mjs
// Summaries live in blocks-cli/command-docs.json; everything else is derived
// from src/index.ts and each command's own source.

export type CommandScope = "account" | "local" | "project" | "project-or-account";

export type CommandEntry = {
  details?: string;
  family: string;
  flags: string[];
  mutating: boolean;
  name: string;
  positional?: string;
  scope: CommandScope;
  summary: string;
};

export const commandCatalog: readonly CommandEntry[] = [
  {
    "name": "auth client-credentials delete",
    "family": "auth",
    "summary": "Delete a machine-to-machine client credential.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "auth client-credentials list",
    "family": "auth",
    "summary": "List this project's machine-to-machine client credentials.",
    "details": "clientSecret is included in list responses; treat CLI output as sensitive.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth client-credentials save",
    "family": "auth",
    "summary": "Omit --item-id to create; pass it to update.",
    "details": "The response carries no clientSecret; read it back from 'auth client-credentials list', which returns it in full.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-token-valid-minutes",
      "active",
      "body",
      "file",
      "item-id",
      "name",
      "permissions",
      "roles"
    ]
  },
  {
    "name": "auth config get",
    "family": "auth",
    "summary": "Read the tenant's AuthController configuration, including isOidcEnabled.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth config save",
    "family": "auth",
    "summary": "Save AuthController config.",
    "details": "Fetches and merges current values first. Enabling OIDC requires accountActionBaseUrl. The --password-policy-* flags set the structured password policy the IAM screens show; --password-strength-message explains a custom --password-strength-regex.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "absolute-refresh-token-minutes",
      "access-token-minutes",
      "account-action-base-url",
      "account-lock-duration-minutes",
      "body",
      "file",
      "logout-on-password-change",
      "oidc-enabled",
      "password-policy-max-length",
      "password-policy-message",
      "password-policy-min-length",
      "password-policy-require-lowercase",
      "password-policy-require-numbers",
      "password-policy-require-special-chars",
      "password-policy-require-uppercase",
      "password-strength-message",
      "password-strength-regex",
      "refresh-token-minutes",
      "remember-me-refresh-token-minutes",
      "wrong-attempts-to-lock"
    ]
  },
  {
    "name": "auth idp create",
    "family": "auth",
    "summary": "Register an identity provider so end users can sign in through it.",
    "details": "Apple-specific fields (teamId, keyId, privateKey, appleAudience) go in --body/--file so no private key lands in shell history. IAM's create endpoint stores issuer/jwksUri/wellKnownUrl but drops authorizationUrl/tokenUrl/userInfoUrl -- set those with 'auth idp update' afterward.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "active",
      "authorization-url",
      "body",
      "client-id",
      "client-secret",
      "display-name",
      "file",
      "grant-types",
      "icon",
      "initial-permissions",
      "initial-roles",
      "issuer",
      "jwks-uri",
      "protocol",
      "provider",
      "provider-type",
      "redirect-uris",
      "require-pkce",
      "response-type",
      "scope",
      "token-endpoint-auth-method",
      "token-url",
      "user-info-url",
      "well-known-url"
    ]
  },
  {
    "name": "auth idp delete",
    "family": "auth",
    "summary": "Irreversible; also deletes the related OIDC client registration.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "auth idp get",
    "family": "auth",
    "summary": "Read one identity provider by id.",
    "positional": "<id>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "auth idp list",
    "family": "auth",
    "summary": "List the project's identity providers.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth idp status",
    "family": "auth",
    "summary": "Enable/disable a provider without deleting its configuration.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "active",
      "id"
    ]
  },
  {
    "name": "auth idp update",
    "family": "auth",
    "summary": "provider/providerType/protocol/clientId are immutable: omit them, or echo the existing values exactly if you also pass --body/--file.",
    "positional": "<id> [same flags as create, all optional]",
    "details": "The only endpoint that persists authorizationUrl/tokenUrl/userInfoUrl -- create accepts and drops them, and update never re-runs discovery, so values set here stick. Use it to repair a provider whose authorizationUrl came back null: '/idp/initiate' builds its redirect from that field, so hosted login goes nowhere without it. Read the endpoint values from the tenant's discovery document rather than composing them by hand.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "active",
      "authorization-url",
      "body",
      "client-id",
      "display-name",
      "file",
      "grant-types",
      "icon",
      "id",
      "initial-permissions",
      "initial-roles",
      "issuer",
      "jwks-uri",
      "protocol",
      "provider",
      "provider-type",
      "redirect-uris",
      "require-pkce",
      "response-type",
      "scope",
      "token-endpoint-auth-method",
      "token-url",
      "user-info-url",
      "well-known-url"
    ]
  },
  {
    "name": "auth oidc-clients delete",
    "family": "auth",
    "summary": "Irreversible; revokes all tokens issued to the client.",
    "positional": "<clientId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "client-id"
    ]
  },
  {
    "name": "auth oidc-clients get",
    "family": "auth",
    "summary": "Read one OIDC client registration.",
    "positional": "<clientId>",
    "details": "Never returns client_secret.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "client-id"
    ]
  },
  {
    "name": "auth oidc-clients list",
    "family": "auth",
    "summary": "List registered OAuth 2.0 / OIDC client applications for the tenant.",
    "details": "client_secret is NOT excluded by the service -- the CLI redacts it in list/get output. Use rotate-secret to obtain a working secret.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth oidc-clients rotate-secret",
    "family": "auth",
    "summary": "Generates a new client_secret, shown once; the old secret stops working immediately.",
    "positional": "<clientId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "client-id"
    ]
  },
  {
    "name": "auth oidc-clients save",
    "family": "auth",
    "summary": "Upsert: omit --item-id to register a new client, pass it to update an existing one.",
    "details": "The response's client_secret is shown here; the service also returns it on list/get, where the CLI redacts it. --client-type is not optional in practice: IAM derives tokenEndpointAuthMethod from it, so omitting it stores a browser/SPA client as confidential (\"client_secret_post\") and lets it request the client_credentials grant. Pass --client-type public for any PKCE/browser client. --register-as-identity-provider creates the linked identity provider in the same call. Its authorize/token/userinfo/jwks/issuer values are filled from the discovery document. When omitted, --external-discovery-endpoint defaults to external provider or non-standard IAM base URL.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "active",
      "allowed-mfa-methods",
      "allowed-response-types",
      "allowed-scopes",
      "auto-redirect",
      "back-channel-logout-uri",
      "body",
      "client-brand-color",
      "client-display-name",
      "client-logo-url",
      "client-type",
      "device-flow-client",
      "external-discovery-endpoint",
      "file",
      "front-channel-logout-uri",
      "item-id",
      "login-mode",
      "oidc-url",
      "post-logout-redirect-uris",
      "redirect-uris",
      "register-as-identity-provider",
      "require-consent",
      "require-mfa",
      "require-pkce",
      "scope",
      "use-tokens-cookie"
    ]
  },
  {
    "name": "auth refresh",
    "family": "auth",
    "summary": "Force account token refresh, or project token refresh with --project.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth remove",
    "family": "auth",
    "summary": "Clear cached tokens and stored local credentials for that account.",
    "positional": "<account>",
    "details": "The packaged default OS account is restored from package defaults.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "auth status",
    "family": "auth",
    "summary": "Show only whether account/project access and refresh tokens are missing, valid, expired, or available.",
    "details": "Does not print account config values.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "captcha delete",
    "family": "captcha",
    "summary": "Delete a captcha configuration and retire its stored secret.",
    "positional": "<id>",
    "details": "The server retires the stored secret first, then removes the record. The confirmation states whether the record is currently enabled, since deleting the enforced one stops requiring a captcha at login. Not undoable. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "captcha disable",
    "family": "captcha",
    "summary": "Disable one captcha configuration without changing anything else.",
    "positional": "<id>",
    "details": "Compound counterpart of captcha enable: re-saves with isEnable false and no secret, then reports which configuration (if any) is now enforced at login. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "captcha enable",
    "family": "captcha",
    "summary": "Enable one captcha configuration without changing anything else.",
    "positional": "<id>",
    "details": "Compound: reads the record, re-saves it with isEnable true and no secret (so the stored secret is untouched), then lists to report activeForLogin. Since blocks-iam enforces the first enabled record in id order, the output (and a stderr note) says when another enabled record still takes precedence. A record that is already enabled reports upToDate. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "captcha get",
    "family": "captcha",
    "summary": "One captcha configuration by id (provider, site key, generator, isEnable, secretId).",
    "positional": "<id>",
    "details": "Never returns the captcha secret, only a secretId reference; no command reveals it. Unknown ids fail with captcha_not_found. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "captcha list",
    "family": "captcha",
    "summary": "List the project's login-captcha configurations and which one blocks-iam enforces.",
    "details": "Output is {activeForLogin, configs, totalCount}. activeForLogin mirrors blocks-iam's rule -- the FIRST enabled record in id order -- so several enabled records are legal but only that one gates login. Each config carries secretId, never the secret value. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "captcha save",
    "family": "captcha",
    "summary": "Create or update a login-captcha configuration.",
    "positional": "[id]",
    "details": "Omit the id to create -- then --enable or --enable=false is required, because the server treats an omitted flag as disabled. Pass the id to update. --provider must be one blocks-iam can verify (recaptcha, hcaptcha, bcaptcha). --captcha-secret stores the secret on create and REPLACES it on update; omitted or empty leaves the stored secret untouched. --body/--file supply raw fields, convenience flags win. The secret is redacted in --dry-run output and never echoed back. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "captcha-key",
      "captcha-secret",
      "enable",
      "file",
      "generator",
      "id",
      "provider"
    ]
  },
  {
    "name": "certificate upload",
    "family": "certificate",
    "summary": "Upload a public certificate for token validation via Certificate/UploadCertificate.",
    "details": "Requires --file pointing at an existing non-empty PEM/CRT. Sends multipart form field 'certificate' plus query isThirdParty (--third-party) and optional providerRef (--provider-ref). Defaults isThirdParty to false and omits providerRef when empty. When --provider-ref is set without --third-party, the query is still sent and JSON notes providerRefIgnoredWhenNotThirdParty. Permission: blocks-os::project::mutate-token-validation-params. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file",
      "provider-ref",
      "third-party"
    ]
  },
  {
    "name": "data config create",
    "family": "data",
    "summary": "Point the Data Gateway at an external database.",
    "details": "Rare and deliberate.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "connection-string",
      "database-name",
      "file"
    ]
  },
  {
    "name": "data config get",
    "family": "data",
    "summary": "Read the project's data-source configuration.",
    "details": "Defaults to Blocks-managed storage.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data config update",
    "family": "data",
    "summary": "Update an existing data-source configuration.",
    "details": "--enable-analytics toggles Graph Log analytics; the first enable opens a 14-day access window. Omitted, the stored value is kept.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "collection-name-editable",
      "collection-name-pattern",
      "connection-string",
      "database-name",
      "enable-analytics",
      "file",
      "item-id"
    ]
  },
  {
    "name": "data files access-grant",
    "family": "data",
    "summary": "Grant a principal access to a file or directory.",
    "positional": "<resourceId>",
    "details": "--principal-type is one of User, Role, Everyone, or Organization.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "effect",
      "expires-at",
      "file",
      "permission",
      "policy-id",
      "principal-id",
      "principal-type",
      "priority",
      "resource-id",
      "resource-type"
    ]
  },
  {
    "name": "data files access-list",
    "family": "data",
    "summary": "List the access policies attached to a resource.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "resource-id"
    ]
  },
  {
    "name": "data files access-resolve",
    "family": "data",
    "summary": "Resolve the effective access a principal has on a resource, including inherited policies.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "resource-id"
    ]
  },
  {
    "name": "data files access-revoke",
    "family": "data",
    "summary": "Remove one access policy from a resource.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "policy-id",
      "resource-id"
    ]
  },
  {
    "name": "data files access-update",
    "family": "data",
    "summary": "Update one access policy on a resource.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "effect",
      "expires-at",
      "file",
      "permission",
      "policy-id",
      "principal-id",
      "principal-type",
      "priority",
      "resource-id",
      "resource-type"
    ]
  },
  {
    "name": "data files complete-upload",
    "family": "data",
    "summary": "Verify and promote a quarantined upload (cloud upload step 3).",
    "positional": "<fileId> <fileVersionId>",
    "details": "Only for an upload whose presign response said uploadCompletionRequired; any other version answers file_version_not_found. Idempotent: a repeat returns the recorded Verified/Rejected outcome.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file-id",
      "file-version-id"
    ]
  },
  {
    "name": "data files copy",
    "family": "data",
    "summary": "Copy a file into another directory.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "copy-access-policies",
      "file-id",
      "target-directory-id"
    ]
  },
  {
    "name": "data files create-version",
    "family": "data",
    "summary": "Add a new version to an existing file.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "configuration-name",
      "file-id"
    ]
  },
  {
    "name": "data files delete",
    "family": "data",
    "summary": "Defaults to moving the file to trash; --permanent removes bytes and metadata.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "configuration-name",
      "event-queue-name",
      "file-id",
      "permanent"
    ]
  },
  {
    "name": "data files directory-create",
    "family": "data",
    "summary": "Create a directory in the object tree.",
    "positional": "<name>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "allowed-extensions",
      "body",
      "configuration-name",
      "description",
      "file",
      "module-name",
      "name",
      "parent-directory-id",
      "parent-id"
    ]
  },
  {
    "name": "data files directory-delete",
    "family": "data",
    "summary": "Delete a directory.",
    "positional": "<directoryId>",
    "details": "Trashes by default; --permanent removes data.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "directory-id",
      "permanent"
    ]
  },
  {
    "name": "data files directory-get",
    "family": "data",
    "summary": "Read one directory's metadata.",
    "positional": "<directoryId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "directory-id"
    ]
  },
  {
    "name": "data files directory-move",
    "family": "data",
    "summary": "Move a directory under a different parent.",
    "positional": "<directoryId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "directory-id",
      "target-directory-id",
      "target-id"
    ]
  },
  {
    "name": "data files directory-update",
    "family": "data",
    "summary": "Rename or re-describe a directory.",
    "positional": "<directoryId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "description",
      "directory-id",
      "file",
      "name"
    ]
  },
  {
    "name": "data files get",
    "family": "data",
    "summary": "Download a file from the storage object tree.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "configuration-name",
      "file-id",
      "version"
    ]
  },
  {
    "name": "data files get-many",
    "family": "data",
    "summary": "Download several files by id in one call.",
    "positional": "<fileId...>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "configuration-name",
      "file-ids"
    ]
  },
  {
    "name": "data files info",
    "family": "data",
    "summary": "List file metadata records with paging and sorting.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "name",
      "page",
      "page-size",
      "sort-by",
      "sort-desc",
      "tenant-id"
    ]
  },
  {
    "name": "data files inheritance",
    "family": "data",
    "summary": "Turn access-policy inheritance on or off for a resource.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "enabled",
      "file",
      "resource-id"
    ]
  },
  {
    "name": "data files list",
    "family": "data",
    "summary": "List object-tree entries under a directory, with cursor paging.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "cursor",
      "limit",
      "module-name",
      "parent-directory-id",
      "parent-id",
      "search",
      "type"
    ]
  },
  {
    "name": "data files move",
    "family": "data",
    "summary": "Move a file into another directory.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file-id",
      "target-directory-id"
    ]
  },
  {
    "name": "data files presigned-upload-url",
    "family": "data",
    "summary": "Mutating cloud step 1: creates metadata/version and returns uploadUrl/fileId.",
    "details": "When the response says uploadCompletionRequired, PUT with its requiredHeaders and finish with 'data files complete-upload <fileId> <fileVersionId>'. Pass --size-in-bytes, --content-type and --checksum so verification can check them.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-modifier",
      "body",
      "checksum",
      "checksum-algorithm",
      "configuration-name",
      "content-type",
      "file",
      "inherits-parent-access",
      "item-id",
      "meta-data",
      "module-name",
      "name",
      "object-access-level",
      "parent-directory-id",
      "size-in-bytes",
      "tags"
    ]
  },
  {
    "name": "data files purge",
    "family": "data",
    "summary": "Permanently delete a trashed entry.",
    "positional": "<resourceId>",
    "details": "Irreversible.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "resource-id"
    ]
  },
  {
    "name": "data files rename",
    "family": "data",
    "summary": "Rename a file.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file-id",
      "name"
    ]
  },
  {
    "name": "data files restore",
    "family": "data",
    "summary": "Restore a trashed object-tree entry.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "resource-id"
    ]
  },
  {
    "name": "data files search",
    "family": "data",
    "summary": "Search the object tree by name.",
    "positional": "<query>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "cursor",
      "directory-id",
      "limit",
      "query",
      "type"
    ]
  },
  {
    "name": "data files share",
    "family": "data",
    "summary": "Share a resource with a principal.",
    "positional": "<resourceId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "effect",
      "expires-at",
      "file",
      "permission",
      "policy-id",
      "principal-id",
      "principal-type",
      "priority",
      "resource-id",
      "resource-type"
    ]
  },
  {
    "name": "data files shared",
    "family": "data",
    "summary": "List object-tree entries shared with the caller.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "cursor",
      "limit",
      "type"
    ]
  },
  {
    "name": "data files trash",
    "family": "data",
    "summary": "List soft-deleted object-tree entries.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "cursor",
      "limit",
      "type"
    ]
  },
  {
    "name": "data files update-additional-info",
    "family": "data",
    "summary": "Replace a file's additional properties.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "additional-properties",
      "item-id"
    ]
  },
  {
    "name": "data files upload",
    "family": "data",
    "summary": "Cloud: create file/version metadata, PUT bytes to the returned URL, then complete the upload when required.",
    "details": "Declares size, content type and a SHA-256 checksum so blocks-data can refuse an oversized file and verify it. When the storage configuration requires completion for the access modifier, the bytes land in quarantine and the command calls complete-upload; a rejected upload fails with its reason. Local: one multipart request. The file appears in the object tree without registration.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-modifier",
      "configuration-name",
      "content-type",
      "file",
      "inherits-parent-access",
      "item-id",
      "local-storage",
      "meta-data",
      "module-name",
      "name",
      "object-access-level",
      "parent-directory-id",
      "parent-id",
      "tags"
    ]
  },
  {
    "name": "data files upload-to-local-storage",
    "family": "data",
    "summary": "One-call alternative to the two commands above, for local-storage-backed projects.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-modifier",
      "additional-properties",
      "configuration-name",
      "file",
      "inherits-parent-access",
      "item-id",
      "meta-data",
      "name",
      "object-access-level",
      "parent-directory-id",
      "tags"
    ]
  },
  {
    "name": "data files upload-to-url",
    "family": "data",
    "summary": "PUT a local file straight to a pre-signed storage URL (upload step 2).",
    "details": "Follows 'data files presigned-upload-url'. Provider-direct PUT - no x-blocks-key and no bearer token, by design. Adds 'x-ms-blob-type: BlockBlob' for Azure; pass --blob-type to change it or --no-blob-type-header to omit it for other providers. The URL's query string is itself a write credential, so dry-run output shows the origin and path only.",
    "scope": "local",
    "mutating": true,
    "flags": [
      "blob-type",
      "content-type",
      "file",
      "no-blob-type-header",
      "url"
    ]
  },
  {
    "name": "data files versions",
    "family": "data",
    "summary": "List a file's stored versions.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "cursor",
      "file-id",
      "limit"
    ]
  },
  {
    "name": "data reload",
    "family": "data",
    "summary": "Reload Data schema configuration so staged schema/rule changes become live.",
    "details": "Mutating; calls POST /data/v4/schema-configurations/reload.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "data rules deploy",
    "family": "data",
    "summary": "Apply schema security and data-access policies.",
    "details": "Mutating; supports dry-run and confirmation. Resolves each policy's destination schema id and any existing policy id by name -- never reuses a source-project id.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "data rules policy delete",
    "family": "data",
    "summary": "Delete one data-access policy without a full rules pull and deploy.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "item-id"
    ]
  },
  {
    "name": "data rules policy get",
    "family": "data",
    "summary": "Read all data-access policies for one schema.",
    "positional": "<schemaName>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "schema-name"
    ]
  },
  {
    "name": "data rules pull",
    "family": "data",
    "summary": "Download data-access policies into blocks/data/rules.json in the CLI's portable format (schemaName, no itemId/schemaId).",
    "details": "Writes local files only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data schema aggregation",
    "family": "data",
    "summary": "Schemas plus an access-level summary (Public/User/Custom x Read/Write/Edit/Delete).",
    "scope": "project",
    "mutating": false,
    "flags": [
      "collection-name",
      "keyword",
      "page",
      "page-size",
      "schema-name",
      "schema-type",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "data schema change-logs",
    "family": "data",
    "summary": "Unadapted schema change logs; data reload clears these.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data schema delete",
    "family": "data",
    "summary": "Irreversible.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "data schema fields",
    "family": "data",
    "summary": "Add/update field definitions; the 'fields' array (name/type/isArray/isPIIData/ isUniqueData/description) goes in --body/--file, e.g.",
    "details": "--body '{\"fields\":[{\"name\":\"email\",\"type\":\"string\"}]}'.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "deletable-fields",
      "file",
      "schema-id"
    ]
  },
  {
    "name": "data schema get",
    "family": "data",
    "summary": "Non-JSON output also prints the schema's exact GraphQL operation names -- generated names are naive string concatenation, not English...",
    "positional": "<id>",
    "details": "Non-JSON output also prints the schema's exact GraphQL operation names -- generated names are naive string concatenation, not English pluralization (e.g. Company -> getCompanys/Companys, not Companies).",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "data schema get-by-name",
    "family": "data",
    "summary": "Full field-level detail by collection name (info-by-name).",
    "positional": "<schemaName>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "schema-name"
    ]
  },
  {
    "name": "data schema info list",
    "family": "data",
    "summary": "Entity-type schema collections with basic info.",
    "details": "--schema-type: 1 Entity, 2 Dto. There is no 0.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data schema info save",
    "family": "data",
    "summary": "Create schema metadata only (no fields yet) - pair with data schema fields.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "collection-name",
      "file",
      "schema-name",
      "schema-type"
    ]
  },
  {
    "name": "data schema info update",
    "family": "data",
    "summary": "Update schema metadata without touching field definitions.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "collection-name",
      "file",
      "item-id",
      "schema-name",
      "schema-type"
    ]
  },
  {
    "name": "data schema list",
    "family": "data",
    "summary": "List project schemas via /data/v4/schemas using an impersonated project token.",
    "details": "Read-only. Page defaults are 1/100; fails clearly on an unexpected response shape instead of treating it as an empty list.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "page",
      "page-size"
    ]
  },
  {
    "name": "data schema pull",
    "family": "data",
    "summary": "Download every project schema (paging through all of them) into blocks/data/schemas/*.json.",
    "details": "Strips the API id, project identifiers, and platform-managed fields so the file is portable and re-pushable as-is. Writes local files only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data schema push",
    "family": "data",
    "summary": "Create or update project schemas via /data/v4/schemas/define.",
    "details": "Mutating. Looks up the destination project's schema by name -- never trusts a local id/itemId, which may belong to another project -- and uses PUT with the destination id when found, POST otherwise. Warns when a local id is ignored; fails clearly instead of treating an empty response as success.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "data sync",
    "family": "data",
    "summary": "Composed flow: validate local schemas/rules, then data schema push -> data rules deploy -> data reload, so pushed changes actually go live in one...",
    "details": "Composed flow: validate local schemas/rules, then data schema push -> data rules deploy -> data reload, so pushed changes actually go live in one step. Validation runs first and hard-fails before anything is sent if it finds errors. Prints 3 separate step outputs (one per underlying command), not one combined document. One confirmation covers the whole flow.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "data validate",
    "family": "data",
    "summary": "Validate local blocks/data/schemas/*.json and blocks/data/rules.json before pushing.",
    "details": "Local-only.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "data validation by-schema",
    "family": "data",
    "summary": "List validation rules for one schema.",
    "positional": "<schemaId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "schema-id"
    ]
  },
  {
    "name": "data validation by-schema-field",
    "family": "data",
    "summary": "List validation rules for one field of one schema.",
    "positional": "<schemaId> <fieldName>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "field-name",
      "schema-id"
    ]
  },
  {
    "name": "data validation delete",
    "family": "data",
    "summary": "Delete a validation rule.",
    "positional": "<validationId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "validation-id"
    ]
  },
  {
    "name": "data validation get",
    "family": "data",
    "summary": "Read one validation rule by id.",
    "positional": "<validationId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "validation-id"
    ]
  },
  {
    "name": "data validation list",
    "family": "data",
    "summary": "List field-level validation rules.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "field-name",
      "keyword",
      "page",
      "page-size",
      "schema-id",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "data validation save",
    "family": "data",
    "summary": "Create or replace the field-level validation rules on a schema field.",
    "details": "One rule from scalar flags: --type regex --value \"^[0-9]+$\" --error-message \"Digits only\". Several rules: a \"validations\" array via --body/--file. --type accepts a name (notempty, regex, minlength, maxlength, lengthrange, equal, notequal, greaterthan, lessthan, greaterthanorequal, lessthanorequal, range) or its number. --item-id is optional: without it the command finds the field's existing rule record and updates it. The endpoint replaces the whole rule list, so the rules passed are the rules the field ends up with; --dry-run reports how many it would replace.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "error-message",
      "field-name",
      "file",
      "is-active",
      "item-id",
      "schema-id",
      "secondary-value",
      "type",
      "value"
    ]
  },
  {
    "name": "deselect",
    "family": "deselect",
    "summary": "Stop the active impersonation (restoring a fresh account refresh token), then clear that account's selected project tenant and blocks.json entry...",
    "details": "Stop the active impersonation (restoring a fresh account refresh token), then clear that account's selected project tenant and blocks.json entry and drop its cached impersonation token. Run 'blocks use <tenantId>' again to reselect and re-impersonate.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "doctor",
    "family": "doctor",
    "summary": "Inspect cached CLI version, Node.js, OIDC config, token, optional project, and storage health.",
    "details": "Account-only mode is valid. Performs no token refresh, network request, or state write. The 'CLI up to date' check reads the daily-cached npm registry lookup; an outdated version is reported (JSON: cliUpdateAvailable) but never fails the run -- ask the user before running 'npm install -g @seliseblocks/cli-os@latest'.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "domain configure",
    "family": "domain",
    "summary": "Set the project's cookie/custom domain via blocks-os Domain/Configure.",
    "details": "Requires --cookie-domain (non-empty). POSTs { cookieDomain } to /os/v4/Domain/Configure and reports { configured, cookieDomain } because the API does not echo the value. Empty domain fails client-side with domain_missing_required_fields (\"domain name is missing\"), matching the server. No get/remove exists on blocks-os yet. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "cookie-domain"
    ]
  },
  {
    "name": "git clone",
    "family": "git",
    "summary": "Clone a GitHub repository and bind it to the selected project.",
    "positional": "<owner/name>",
    "details": "Clones with the connected GitHub account's credential into --dir (default: the repository name) and writes repo + project.tenantId into that directory's blocks.json, merging with any blocks.json the repository already carries. Refuses a non-empty directory with directory_not_empty -- attaching an existing directory is 'git connect'.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "branch",
      "dir",
      "repo"
    ]
  },
  {
    "name": "git connect",
    "family": "git",
    "summary": "Attach this directory to an existing GitHub repository, with an explicit strategy for the two histories.",
    "positional": "<owner/name>",
    "details": "--strategy is required (strategy_required) because every choice destroys something: keep-local force-pushes this directory's branch over the remote's; adopt-remote resets this directory to the remote branch, discarding local commits and uncommitted files; merge joins the unrelated histories and pushes, aborting with merge_conflict (nothing pushed) if they conflict. Requires an existing git repository here (not_a_git_repository otherwise -- use 'git init'). Records the binding in blocks.json. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "branch",
      "message",
      "repo",
      "strategy"
    ]
  },
  {
    "name": "git disconnect",
    "family": "git",
    "summary": "Forget the connected repository without touching git history or GitHub.",
    "details": "Removes only the repo entry from blocks.json; .git, its remotes, every commit and the GitHub repository are left as they are. Undo with 'git connect <owner/name> --strategy keep-local'. Mutating.",
    "scope": "local",
    "mutating": true,
    "flags": []
  },
  {
    "name": "git init",
    "family": "git",
    "summary": "Create a GitHub repository for code that exists only here, push it, and connect it.",
    "details": "Creates the repository through blocks-release using the GitHub account connected via 'blocks github connect' (or the portal) (private unless --public; --org places it under an organisation the account belongs to; --repo <owner/name> uses an existing empty repository instead). Runs git init if needed, ensures a .gitignore, commits everything, pushes --branch (default main, or the current branch) and writes the repo binding to blocks.json. Refuses with repo_already_bound when a repository is already connected -- run 'git disconnect' first. github_not_connected means the Blocks account has no GitHub connection -- run 'blocks github connect'. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "branch",
      "description",
      "message",
      "name",
      "org",
      "public",
      "repo"
    ]
  },
  {
    "name": "git pull",
    "family": "git",
    "summary": "Pull the connected branch from GitHub.",
    "details": "Requires a connected repository (repo_not_bound). Refuses when the working tree has uncommitted changes (working_tree_dirty) rather than stashing them. A conflicting pull is aborted and reported as merge_conflict. --rebase rebases instead of merging.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "rebase"
    ]
  },
  {
    "name": "git push",
    "family": "git",
    "summary": "Commit what changed and push the connected branch to GitHub.",
    "details": "Requires a connected repository (repo_not_bound). Stages and commits all changes with --message (default 'Update from Blocks'), then pushes; with nothing changed and nothing ahead it exits 0 with nothingToPush:true. A non-fast-forward rejection is push_rejected with 'blocks git pull' as the next step. This is the command Studio runs after a successful build, with --yes and the run's summary as --message. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "message"
    ]
  },
  {
    "name": "git status",
    "family": "git",
    "summary": "Connected repository, branch, uncommitted files and ahead/behind counts for this workspace.",
    "details": "Local and read-only -- never fetches, so behind reflects the last fetch or pull. Exits 0 with bound:null / isRepository:false when nothing is connected, so a caller branches on the JSON rather than on an error.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "github connect",
    "family": "github",
    "summary": "Connect this Blocks account to GitHub via OAuth (open browser, then poll).",
    "details": "Resolves the public BLOCKS_GITHUB_SSO_CLIENT_ID from blocks-release's served SPA (or BLOCKS_GITHUB_SSO_CLIENT_ID env), opens the GitHub authorize URL with scopes repo, user:email, read:user, read:repo_hook, then polls GET /release/v4/Github/credential every 5s until connected or --timeout (default 300). --dry-run prints the authorize URL and plan without opening a browser or polling. Stores nothing new locally -- blocks-release persists the token. Mutating (GitHub consent / server-side token).",
    "scope": "project",
    "mutating": false,
    "flags": [
      "timeout"
    ]
  },
  {
    "name": "github status",
    "family": "github",
    "summary": "Show whether this Blocks account has a GitHub connection.",
    "details": "Calls GET /release/v4/Github/credential. Reports {connected:false} on 404, or {connected:true,login} when a credential exists. Read-only; never opens a browser.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam email available",
    "family": "iam",
    "summary": "Check whether an email address is free to register.",
    "positional": "<email>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "email"
    ]
  },
  {
    "name": "iam me",
    "family": "iam",
    "summary": "Read the current user from IAM (bootstrapping/CLI operator identity, not a project resource).",
    "details": "The server resolves this to the root identity either way, so the impersonated project session works too.",
    "scope": "project-or-account",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam organizations config get",
    "family": "iam",
    "summary": "Read the tenant's organization policy, including isMultiOrgEnabled.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam organizations config save",
    "family": "iam",
    "summary": "Save the tenant's organization policy.",
    "details": "Reads the current policy and merges the flags over it; pass --flag=false to switch a setting off. --org-name-uniqueness makes organization names unique within the tenant. Multi-org can only be switched on, once, with --consent-for-multi-org-enable.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "allow-org-creation-from-cloud",
      "allow-org-creation-from-construct",
      "allow-org-creation-from-portal",
      "allow-org-creation-from-signup",
      "body",
      "consent-for-multi-org-enable",
      "file",
      "multi-org-enabled",
      "org-name-uniqueness"
    ]
  },
  {
    "name": "iam organizations create",
    "family": "iam",
    "summary": "Create an organization.",
    "details": "Organizations are a tenant-isolation boundary.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "default-permissions",
      "default-roles",
      "description",
      "email",
      "file",
      "name",
      "phone-number",
      "website-url"
    ]
  },
  {
    "name": "iam organizations get",
    "family": "iam",
    "summary": "Read one organization by id.",
    "positional": "<id>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "iam organizations list",
    "family": "iam",
    "summary": "List organizations in the project.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "ids",
      "is-disabled",
      "page",
      "page-size",
      "parent-organization-id",
      "search",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "iam organizations my",
    "family": "iam",
    "summary": "List the signed-in user's own organizations.",
    "details": "Source for an org switcher.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam organizations update",
    "family": "iam",
    "summary": "Update an organization's profile and locale settings.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "currency",
      "description",
      "email",
      "file",
      "id",
      "industry",
      "is-enabled",
      "locale",
      "name",
      "phone-number",
      "time-zone",
      "website-url"
    ]
  },
  {
    "name": "iam permissions by-severity",
    "family": "iam",
    "summary": "List permissions filtered by severity and resource type.",
    "details": "--severity is PermissionSeverity, ordered most-severe-first, not least: 0 None, 1 Critical, 2 High, 3 Medium, 4 Low. --type is IAM's ResourceType: 0 None, 1 Endpoint, 2 FrontendAction, 3 DataProtection.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam permissions create",
    "family": "iam",
    "summary": "Create an IAM permission definition.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "dependent-permissions",
      "description",
      "file",
      "is-built-in",
      "name",
      "resource",
      "resource-group",
      "severity",
      "tags",
      "type"
    ]
  },
  {
    "name": "iam permissions get",
    "family": "iam",
    "summary": "Read one IAM permission by id.",
    "positional": "<id>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "iam permissions list",
    "family": "iam",
    "summary": "List IAM permissions.",
    "details": "--type is ResourceType (0-3), --severity is PermissionSeverity (0 None, 1 Critical .. 4 Low).",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "file",
      "is-archived",
      "is-built-in",
      "organization-id",
      "page",
      "page-size",
      "resource-group",
      "resources",
      "roles",
      "search",
      "severity",
      "sort-by",
      "sort-desc",
      "tags",
      "type"
    ]
  },
  {
    "name": "iam permissions update",
    "family": "iam",
    "summary": "Update an IAM permission definition, including archiving it.",
    "positional": "<id> [same flags as create, plus",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "dependent-permissions",
      "description",
      "file",
      "id",
      "is-archived",
      "is-built-in",
      "name",
      "resource",
      "resource-group",
      "severity",
      "tags",
      "type"
    ]
  },
  {
    "name": "iam resources features",
    "family": "iam",
    "summary": "List IAM feature flags for the active user context.",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "is-built-in",
      "search"
    ]
  },
  {
    "name": "iam resources groups",
    "family": "iam",
    "summary": "List IAM resource groups.",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam roles assign-permissions",
    "family": "iam",
    "summary": "Add or remove permissions on a role, addressed by slug.",
    "positional": "<slug>",
    "details": "Resolves permission resource strings to itemIds first.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "add-permissions",
      "organization-id",
      "remove-permissions",
      "slug"
    ]
  },
  {
    "name": "iam roles assignable",
    "family": "iam",
    "summary": "List the roles the current caller is allowed to assign to others.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam roles create",
    "family": "iam",
    "summary": "Create an IAM role.",
    "details": "Role hierarchy keys off --parent-role-slug, not itemId.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "can-create-own",
      "description",
      "file",
      "name",
      "parent-role-slug",
      "slug"
    ]
  },
  {
    "name": "iam roles get",
    "family": "iam",
    "summary": "Read one IAM role by id.",
    "positional": "<id>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "iam roles list",
    "family": "iam",
    "summary": "List IAM roles defined in the project.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "file",
      "organization-id",
      "page",
      "page-size",
      "search",
      "slugs",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "iam roles update",
    "family": "iam",
    "summary": "Update an IAM role's name, description, or parent.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "can-create-own",
      "description",
      "file",
      "item-id",
      "name",
      "parent-role-slug",
      "propagate-to-other-org"
    ]
  },
  {
    "name": "iam signup-settings get",
    "family": "iam",
    "summary": "Read the tenant's signup policy.",
    "details": "Public endpoint.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "iam signup-settings save",
    "family": "iam",
    "summary": "Save the tenant's signup policy.",
    "details": "Boolean flags only turn settings on; use --body to switch one off.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "default-permissions",
      "default-roles",
      "email-password-signup",
      "file",
      "sso-signup"
    ]
  },
  {
    "name": "iam users access grant",
    "family": "iam",
    "summary": "Grant roles or permissions to an IAM user.",
    "positional": "<userId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "organization-id",
      "permissions",
      "roles",
      "user-id"
    ]
  },
  {
    "name": "iam users access revoke",
    "family": "iam",
    "summary": "Revoke an IAM user's roles and permissions.",
    "positional": "<userId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "organization-id",
      "user-id"
    ]
  },
  {
    "name": "iam users activate",
    "family": "iam",
    "summary": "Enable a disabled IAM user account.",
    "positional": "<userId>",
    "details": "Not the same as the user completing their own activation link.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "reason",
      "user-id"
    ]
  },
  {
    "name": "iam users create",
    "family": "iam",
    "summary": "Create an IAM user.",
    "details": "Requires --email or --user-name; omit --password to let the user set their own via activation mail.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "email",
      "file",
      "first-name",
      "last-name",
      "organization-id",
      "password",
      "permissions",
      "phone-number",
      "roles",
      "user-name"
    ]
  },
  {
    "name": "iam users deactivate",
    "family": "iam",
    "summary": "Disable an IAM user account, suspending their access.",
    "positional": "<userId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "user-id"
    ]
  },
  {
    "name": "iam users exists",
    "family": "iam",
    "summary": "Check whether an IAM user with this email exists.",
    "positional": "<email>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "email"
    ]
  },
  {
    "name": "iam users get",
    "family": "iam",
    "summary": "Read one IAM user by id.",
    "positional": "<id>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id",
      "organization-id"
    ]
  },
  {
    "name": "iam users list",
    "family": "iam",
    "summary": "Query users with paging, sorting, and filters.",
    "details": "Convenience filters are --email/--name/--organization-id. For any other filter, pass a raw JSON object in --body/--file with a \"filter\" key, e.g. --body '{\"filter\":{\"isActive\":true}}'; the convenience flags are merged over it.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "email",
      "file",
      "name",
      "organization-id",
      "page",
      "page-size",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "iam users update",
    "family": "iam",
    "summary": "Update an existing IAM user's profile fields (sparse patch: omitted fields are kept). Roles/permissions/MFA belong to 'iam users access grant' and the MFA commands.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "file",
      "first-name",
      "id",
      "last-name",
      "organization-id",
      "phone-number"
    ]
  },
  {
    "name": "init",
    "family": "init",
    "summary": "Create local Blocks workspace files: blocks.json, data schema/rules folders, and .env.example.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization assistant translation-suggestion",
    "family": "localization",
    "summary": "Ask the localization assistant to suggest a translation for one string.",
    "details": "--source-text is required. --glossary-ids constrains the suggestion to agreed terminology; --temperature and --max-character-length tune the output.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "current-language",
      "destination-language",
      "destination-language-code",
      "element-application-context",
      "element-detail-context",
      "element-type",
      "file",
      "glossary-ids",
      "max-character-length",
      "module-id",
      "source-text",
      "temperature"
    ]
  },
  {
    "name": "localization config get-webhook",
    "family": "localization",
    "summary": "Read the tenant's localization change webhook.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization config save-webhook",
    "family": "localization",
    "summary": "Create or update the webhook the Localization service calls on changes.",
    "details": "Upsert: omit --item-id to create, pass it to update. --secret and --header-key sign the callback so the receiver can verify it; both are redacted from dry-run output.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "content-type",
      "file",
      "header-key",
      "is-disabled",
      "item-id",
      "secret",
      "url"
    ]
  },
  {
    "name": "localization glossary delete",
    "family": "localization",
    "summary": "Delete a glossary term.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "localization glossary get",
    "family": "localization",
    "summary": "Read one glossary term.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "localization glossary list",
    "family": "localization",
    "summary": "List glossary terms.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "is-global",
      "module-id",
      "page-number",
      "page-size",
      "search"
    ]
  },
  {
    "name": "localization glossary save",
    "family": "localization",
    "summary": "Create or update a glossary term.",
    "details": "Upsert on --item-id.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "additional-note",
      "body",
      "context",
      "file",
      "is-global",
      "item-id",
      "language",
      "module-ids",
      "name",
      "type"
    ]
  },
  {
    "name": "localization glossary suggested",
    "family": "localization",
    "summary": "Get AI-suggested glossary terms for an entry.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id",
      "max-results"
    ]
  },
  {
    "name": "localization key delete",
    "family": "localization",
    "summary": "Delete one localization key.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "localization key delete-keys",
    "family": "localization",
    "summary": "Delete several localization keys in one call.",
    "positional": "<itemId...>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "item-ids"
    ]
  },
  {
    "name": "localization key generate-uilm-file",
    "family": "localization",
    "summary": "Generate a UILM language file for a module.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "guid",
      "module-id"
    ]
  },
  {
    "name": "localization key get",
    "family": "localization",
    "summary": "Read one localization key by itemId.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "localization key get-by-names",
    "family": "localization",
    "summary": "Look up localization keys by name.",
    "positional": "<keyName...>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "key-names",
      "module-id"
    ]
  },
  {
    "name": "localization key get-language-file-generation-history",
    "family": "localization",
    "summary": "List past UILM language-file generation runs.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "page-number",
      "page-size"
    ]
  },
  {
    "name": "localization key get-localization-timeline",
    "family": "localization",
    "summary": "Read the tenant-wide localization change history.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "create-date-end",
      "create-date-start",
      "exclude-log-from-values",
      "log-from",
      "log-from-values",
      "page-number",
      "page-size",
      "sort-by",
      "sort-desc",
      "user-id"
    ]
  },
  {
    "name": "localization key get-timeline",
    "family": "localization",
    "summary": "Read the change history for a localization entity.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "create-date-end",
      "create-date-start",
      "entity-id",
      "page-number",
      "page-size",
      "sort-by",
      "sort-desc",
      "user-id"
    ]
  },
  {
    "name": "localization key get-timeline-by-operation-id",
    "family": "localization",
    "summary": "Read the change history for one async operation.",
    "positional": "<operationId>",
    "details": "Use with translate-and-export --wait.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "operation-id",
      "page-number",
      "page-size"
    ]
  },
  {
    "name": "localization key get-uilm-exported-files",
    "family": "localization",
    "summary": "List previously exported UILM files.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "create-date-end",
      "create-date-start",
      "page-number",
      "page-size",
      "search"
    ]
  },
  {
    "name": "localization key get-uilm-file",
    "family": "localization",
    "summary": "Read a generated UILM language file for a module and language.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "language",
      "module"
    ]
  },
  {
    "name": "localization key list",
    "family": "localization",
    "summary": "Search localization keys across modules and languages.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "create-date-end",
      "create-date-start",
      "file",
      "glossary-id",
      "is-partially-translated",
      "key-search-text",
      "last-update-date-end",
      "last-update-date-start",
      "missing-languages",
      "module-ids",
      "page-number",
      "page-size",
      "search-key",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "localization key rollback",
    "family": "localization",
    "summary": "Roll back one localization timeline entry.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "localization key save",
    "family": "localization",
    "summary": "Create or update one localization key.",
    "details": "Upsert on --item-id.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "context",
      "culture",
      "file",
      "glossary-ids",
      "is-new-key",
      "is-partially-translated",
      "item-id",
      "key-name",
      "module-id",
      "routes",
      "should-publish",
      "value"
    ]
  },
  {
    "name": "localization key translate-all",
    "family": "localization",
    "summary": "Trigger AI machine translation for every untranslated key in a module.",
    "details": "Async.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "default-language",
      "message-co-relation-id",
      "module-id"
    ]
  },
  {
    "name": "localization key translate-and-export",
    "family": "localization",
    "summary": "Composed flow: translate-all -> generate-uilm-file -> uilm-export.",
    "details": "Without --wait, fires all 3 back to back (same as running them by hand). With --wait, polls GetTimelineByOperationId (using a generated messageCoRelationId) between translate and generate, since translation runs async and there's no documented explicit \"done\" field to check -- it stops once the timeline entry count settles across 2 polls, or times out with a clear next-step message. Prints one output block per step, not a single combined document.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "app-ids",
      "caller-tenant-id",
      "default-language",
      "end-date",
      "guid",
      "languages",
      "message-co-relation-id",
      "module-id",
      "output-type",
      "poll-interval",
      "reference-file-id",
      "start-date",
      "timeout",
      "wait"
    ]
  },
  {
    "name": "localization key translate-key",
    "family": "localization",
    "summary": "Trigger AI machine translation for one key.",
    "positional": "<keyId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "default-language",
      "key-id",
      "message-co-relation-id"
    ]
  },
  {
    "name": "localization key translate-keys",
    "family": "localization",
    "summary": "Trigger AI machine translation for several keys.",
    "positional": "<keyId...>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "default-language",
      "key-ids",
      "message-co-relation-id",
      "project-key"
    ]
  },
  {
    "name": "localization key uilm-export",
    "family": "localization",
    "summary": "Export translation keys as a downloadable UILM file.",
    "details": "--output-type selects the format: 0 Json (default), 1 Xml, 2 Text, 3 Xlsx, 4 Csv, 5 Xlf.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "app-ids",
      "caller-tenant-id",
      "end-date",
      "languages",
      "message-co-relation-id",
      "output-type",
      "reference-file-id",
      "start-date"
    ]
  },
  {
    "name": "localization key uilm-import",
    "family": "localization",
    "summary": "Import a previously exported UILM file by file id.",
    "positional": "<fileId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file-id",
      "message-co-relation-id"
    ]
  },
  {
    "name": "localization language delete",
    "family": "localization",
    "summary": "Remove a language from the tenant's catalog.",
    "positional": "<languageName>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "language-name"
    ]
  },
  {
    "name": "localization language list",
    "family": "localization",
    "summary": "List languages in the tenant's catalog.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization language list-for-tenant",
    "family": "localization",
    "summary": "List languages enabled for the current tenant.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization language save",
    "family": "localization",
    "summary": "Add or update a language in the tenant's catalog.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "file",
      "is-default",
      "item-id",
      "language-code",
      "language-name"
    ]
  },
  {
    "name": "localization language set-default",
    "family": "localization",
    "summary": "Set the tenant's default language.",
    "positional": "<languageName>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "language-name"
    ]
  },
  {
    "name": "localization module list",
    "family": "localization",
    "summary": "List localization modules.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization module list-for-tenant",
    "family": "localization",
    "summary": "List localization modules for the current tenant.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "localization module save",
    "family": "localization",
    "summary": "Create or update a localization module.",
    "details": "Upsert on --item-id.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "file",
      "item-id",
      "module-name"
    ]
  },
  {
    "name": "localization module tag-glossary",
    "family": "localization",
    "summary": "Attach glossary terms to a localization module.",
    "positional": "<moduleId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "glossary-ids",
      "module-id"
    ]
  },
  {
    "name": "localization pull",
    "family": "localization",
    "summary": "Download published cloud localization via /localization/v4/Key/GetCloudUilmFile and write a local JSON dictionary.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "language",
      "module",
      "out"
    ]
  },
  {
    "name": "localization push",
    "family": "localization",
    "summary": "Create or update Localization keys from a local i18n JSON dictionary via /localization/v4/Key/SaveKeys.",
    "details": "Creates the module first when it is missing.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "context",
      "file",
      "language",
      "module",
      "route"
    ]
  },
  {
    "name": "localization validate",
    "family": "localization",
    "summary": "Validate a local i18n JSON dictionary.",
    "details": "Supports nested JSON input and validates the flattened key/value set locally.",
    "scope": "local",
    "mutating": false,
    "flags": [
      "file",
      "language",
      "module"
    ]
  },
  {
    "name": "logic get",
    "family": "logic",
    "summary": "Fetch one workflow from blocks-logic Workflow/Get.",
    "positional": "<workflow-id>",
    "details": "GETs Workflow/Get?WorkflowId=<id> and returns the response verbatim. Missing workflows fail with logic_workflow_not_found. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logic list",
    "family": "logic",
    "summary": "List workflows from blocks-logic Workflow/GetAll.",
    "details": "POSTs {Search, IsPublished, PageNumber, PageSize} to Workflow/GetAll and returns the response verbatim. --published-only sets IsPublished true; --page is 1-based (sent 0-based); --page-size defaults to 20. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "page",
      "page-size",
      "published-only"
    ]
  },
  {
    "name": "logic proxy create",
    "family": "logic",
    "summary": "Create a logic proxy (simple flags or full --file body).",
    "details": "Mode A: --name, --upstream (absolute https://), --methods (CSV of GET,POST,PUT,PATCH,DELETE), optional --enabled/--disabled (default enabled). Mode B: --file with a full ProxyCreateRequestDto (routes/headers/query/access/…). Modes are mutually exclusive. POSTs /logic/v4/Proxies, then GETs the new proxy and prints the full ProxyDetailDto (including server-derived slug). Surfaces PROXY_SLUG_CONFLICT and PROXY_VALIDATION verbatim. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy delete",
    "family": "logic",
    "summary": "Hard-delete a logic proxy.",
    "positional": "<proxy-id>",
    "details": "DELETEs /logic/v4/Proxies/{id}. Requires --yes (or interactive confirmation). Reports {itemId, deleted:true}. Server retains version history and execution logs. Errors: proxy_not_found. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy disable",
    "family": "logic",
    "summary": "Disable a logic proxy via PATCH (Enabled=false).",
    "positional": "<proxy-id>",
    "details": "PATCHes /logic/v4/Proxies/{id} with {ItemId, Enabled:false}. Does not change any other field. Reports {itemId, enabled:false}. Errors: proxy_not_found. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy enable",
    "family": "logic",
    "summary": "Enable a logic proxy via PATCH (Enabled=true).",
    "positional": "<proxy-id>",
    "details": "PATCHes /logic/v4/Proxies/{id} with {ItemId, Enabled:true}. Does not change any other field. Reports {itemId, enabled:true}. Errors: proxy_not_found. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy execution",
    "family": "logic",
    "summary": "Fetch one proxy execution detail.",
    "positional": "<proxy-id> <execution-id>",
    "details": "GETs /logic/v4/Proxies/{id}/executions/{executionId}. Returns ProxyExecutionDetailDto verbatim, or {\"data\":null} (exit 0) for unknown/mismatched/foreign ids — never a 404. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logic proxy executions",
    "family": "logic",
    "summary": "List recent proxy executions (rolling 24h window).",
    "positional": "<proxy-id>",
    "details": "GETs /logic/v4/Proxies/{id}/executions. --status-class all|2xx|4xx|5xx (default all). --after-id live-tails (ignores --page). --as-of pins the window across pages (echo asOfUtc). Page 0-based; page-size default 25. Errors: PROXY_NOT_FOUND, PROXY_VALIDATION. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "after-id",
      "as-of",
      "status-class"
    ]
  },
  {
    "name": "logic proxy get",
    "family": "logic",
    "summary": "Fetch one proxy from /logic/v4/Proxies/{id}.",
    "positional": "<proxy-id>",
    "details": "Returns the API response verbatim. Unknown or foreign ids return {\"data\":null} with exit 0 (matching the API contract), not an error. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logic proxy list",
    "family": "logic",
    "summary": "List Proxies from blocks-logic /logic/v4/Proxies.",
    "details": "GETs /logic/v4/Proxies with Search, optional IsActive (--active/--inactive), Page (0-based, default 0), PageSize (1-200, default 20). Returns the API response verbatim (items + totalCount). Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "search"
    ]
  },
  {
    "name": "logic proxy overview",
    "family": "logic",
    "summary": "Proxy metrics overview (rolling 24h / all-time).",
    "positional": "<proxy-id>",
    "details": "GETs /logic/v4/Proxies/{id}/overview and returns ProxyOverviewDto verbatim (calls24h, avgLatencyMs, errorRatePct, …). Errors: PROXY_NOT_FOUND only when the proxy is unknown AND has no execution rows. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logic proxy revert",
    "family": "logic",
    "summary": "Revert a proxy to a prior version.",
    "positional": "<proxy-id> <version-id>",
    "details": "POSTs /logic/v4/Proxies/{id}/versions/{versionId}/revert. Reports {itemId, revertedTo}. History is append-only (a Revert row is recorded). Errors: PROXY_NOT_FOUND, PROXY_VERSION_NOT_FOUND, PROXY_DELETED, PROXY_REVERT_CONFLICT, PROXY_VERSION_NOT_REVERTABLE. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy test",
    "family": "logic",
    "summary": "Test a saved proxy or an unsaved draft against upstream without writing logs.",
    "positional": "<proxy-id>",
    "details": "Exactly one of a positional proxy id or --draft-file (create-shaped JSON). Requires --method. Optional --path-suffix, --query, --body, --content-type. POSTs /logic/v4/Proxies/test and returns ProxyTestResponseDto verbatim. Creates no ProxyExecutions row and mutates nothing. Errors: PROXY_VALIDATION (client-side for both/neither target; server-side for bad method etc.).",
    "scope": "project",
    "mutating": false,
    "flags": [
      "body",
      "content-type",
      "draft-file",
      "method",
      "path-suffix",
      "query"
    ]
  },
  {
    "name": "logic proxy update",
    "family": "logic",
    "summary": "Update a logic proxy with read-before-write merge (or full --file replace).",
    "positional": "<proxy-id>",
    "details": "Mode A: any subset of --name/--upstream/--methods — CLI GETs the current ProxyDetailDto, merges only the supplied fields, and PUTs the complete body so routes/headers/access are not wiped. Mode B: --file supplies the full replacement body. Enabled and Slug are never sent (PATCH-only / immutable). Follow-up GET prints the stored detail. Errors: proxy_not_found (no PUT), PROXY_VALIDATION. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic proxy versions",
    "family": "logic",
    "summary": "List a proxy's version history (newest first).",
    "positional": "<proxy-id>",
    "details": "GETs /logic/v4/Proxies/{id}/versions with Page (0-based) and PageSize (default 50). Returns ProxyVersionDto rows + totalCount verbatim. Works for proxies that were later deleted. Errors: PROXY_NOT_FOUND when the id never existed for this tenant. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logic publish",
    "family": "logic",
    "summary": "Publish a draft workflow (or a named new version) in blocks-logic.",
    "positional": "<workflow-id-or-file>",
    "details": "Accepts a workflowId or a local file path whose workflowId is recorded in blocks.json. Without --version-name, POSTs Workflow/PublishVersion for the current draft. With --version-name, POSTs Workflow/PublishNewVersion and includes the resulting versionId. Confirms unless --yes. --dry-run shows the endpoint without calling it. Errors: logic_workflow_not_found, logic_not_a_pushed_file, logic_publish_failed. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "version-name"
    ]
  },
  {
    "name": "logic push",
    "family": "logic",
    "summary": "Compile a YAML workflow file and create or update it in blocks-logic.",
    "positional": "<file>",
    "details": "Reads a workflow-as-code YAML (or JSON) file, validates node types and edge handles against the embedded blocks-logic catalog, applies safety fixups, and auto-layouts nodes. When blocks.json has no workflowId for this file, uploads via Storage/GetPreSignedUrlForUpload, enqueues Workflow/Import, and by default polls Notifier/GetNotifications until the CorrelationId-matched result arrives, then records workflowId under logic.workflows[<file>]. When a workflowId is already recorded, compiles the same way and calls Workflow/Update synchronously with {ItemId, Name, Nodes, Edges, Settings}, reporting {workflowId, name, updated:true}. --dry-run prints the compiled document (and workflowId when updating) without calling the API. --no-wait applies only to the create/Import path. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "no-wait",
      "poll-interval",
      "timeout",
      "wait"
    ]
  },
  {
    "name": "logic scheduler create",
    "family": "logic",
    "summary": "Create a cron-triggered webhook schedule in blocks-logic.",
    "details": "Requires --name, --cron (5-field), --url (absolute), or supply the full body via --file. Optional --method (default POST), repeatable --header key=value, --payload, --signing-secret (sent, never echoed), --description, --start-date, --end-date. POSTs Scheduler/CreateSchedule. Reports {itemId,name,cronExpression,isActive:true}. Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file"
    ]
  },
  {
    "name": "logic scheduler delete",
    "family": "logic",
    "summary": "Delete a logic schedule.",
    "positional": "<schedule-id>",
    "details": "Confirms the schedule exists via GetSchedules, then POSTs Scheduler/DeleteSchedule. Requires --yes. Reports {itemId, deleted:true}. Errors: scheduler_not_found. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "logic scheduler list",
    "family": "logic",
    "summary": "List logic schedules from Scheduler/GetSchedules.",
    "details": "POSTs {Search, PageNumber (0-based), PageSize (default 10)} to GetSchedules and returns the response with signingSecret fields stripped. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "search"
    ]
  },
  {
    "name": "logic scheduler update",
    "family": "logic",
    "summary": "Update a schedule with read-before-write merge.",
    "positional": "<schedule-id>",
    "details": "Lists schedules and filters by id (no GetById), merges supplied flags (or --file body), POSTs Scheduler/UpdateSchedule. --active/--inactive toggles IsActive. Errors: scheduler_not_found (no Update call). Mutating unless --dry-run.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file"
    ]
  },
  {
    "name": "login",
    "family": "login",
    "summary": "Device-code login.",
    "details": "Prints a verification URL and user code, opens the browser to the verification page when possible so you only need to click approve, then polls until the device is authorized; bootstraps a missing named profile without importing credentials, stores account access and refresh tokens, and makes that account active. If a project was previously selected, re-impersonates it automatically; otherwise lists projects and prompts you to run 'blocks use <tenantId>'.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "logout",
    "family": "logout",
    "summary": "Revoke the current refresh token when possible and remove local session data.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "mail config delete",
    "family": "mail",
    "summary": "Delete a mail configuration.",
    "positional": "<configurationId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "mail config duplicate",
    "family": "mail",
    "summary": "Copy an existing mail configuration into a new one.",
    "positional": "<configurationId>",
    "details": "An office365-smtp source needs --client-secret for the copy: a duplicate never shares the source's secret.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "client-secret",
      "id"
    ]
  },
  {
    "name": "mail config get",
    "family": "mail",
    "summary": "Read one mail configuration by name.",
    "positional": "<name>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "name"
    ]
  },
  {
    "name": "mail config list",
    "family": "mail",
    "summary": "List SMTP/inbound mail configurations for the selected project.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "mail config save",
    "family": "mail",
    "summary": "Create or update an SMTP / inbound mail server configuration.",
    "details": "Upsert: omit --configuration-id to create; pass it to update. --provider takes amazon-ses, zoho or office365-smtp (or the raw number); --security-mode takes legacy, none, starttls or ssl-on-connect. office365-smtp is outbound-only OAuth: pass --entra-tenant-id (the Microsoft Entra tenant, not the Blocks one), --client-id, --client-secret and --mailbox-address, and no --account-password; the server fixes host, port and TLS. The client secret goes to Blocks Secrets and is never returned; omit it on an update to keep the stored one. Provider and direction cannot change on an existing configuration. --account-password and --client-secret are redacted from dry-run output.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "account-password",
      "body",
      "client-id",
      "client-secret",
      "configuration-id",
      "enable-ssl",
      "entra-tenant-id",
      "file",
      "host",
      "inbound",
      "mailbox-address",
      "name",
      "port",
      "sender-address",
      "sender-name",
      "sender-username"
    ]
  },
  {
    "name": "mail mailbox get",
    "family": "mail",
    "summary": "Read one mailbox message by id.",
    "positional": "<messageId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "mail mailbox list",
    "family": "mail",
    "summary": "List mailbox messages.",
    "details": "Filters are date, status, search and direction only; there is no --configuration-id.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "end-date",
      "inbound",
      "page-number",
      "page-size",
      "search",
      "start-date",
      "status"
    ]
  },
  {
    "name": "mail send",
    "family": "mail",
    "summary": "Send an email through the tenant's default mail configuration (/logic/v4/Mail/Send).",
    "details": "--project-key defaults to the selected project.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "attachments",
      "bcc",
      "body",
      "body-data-context",
      "cc",
      "file",
      "language",
      "project-key",
      "purpose",
      "reply-to",
      "send-phone-number-as-email",
      "subject-data-context",
      "to"
    ]
  },
  {
    "name": "mail sendtoany",
    "family": "mail",
    "summary": "Same as mail send but via /logic/v4/Mail/SendToAny, which lets the mail provider route the send (e.g.",
    "positional": "[same flags as mail send, plus",
    "details": "mark it --is-test-mail).",
    "scope": "project",
    "mutating": true,
    "flags": [
      "attachments",
      "bcc",
      "body",
      "body-data-context",
      "cc",
      "file",
      "is-test-mail",
      "language",
      "project-key",
      "purpose",
      "reply-to",
      "send-phone-number-as-email",
      "subject-data-context",
      "to"
    ]
  },
  {
    "name": "mail template clone",
    "family": "mail",
    "summary": "Copy a mail template into a new one.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "configuration-id",
      "id",
      "language",
      "name",
      "subject"
    ]
  },
  {
    "name": "mail template delete",
    "family": "mail",
    "summary": "Delete a mail template.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "mail template get",
    "family": "mail",
    "summary": "Read one mail template by itemId.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "mail template list",
    "family": "mail",
    "summary": "List mail templates, optionally filtered by configuration.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "configuration-id",
      "language",
      "page-number",
      "page-size",
      "search",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "mail template save",
    "family": "mail",
    "summary": "Create or update a mail template for one language.",
    "details": "Upsert: omit --item-id to create; pass it to update.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "configuration-id",
      "file",
      "image-id",
      "image-url",
      "item-id",
      "json-content",
      "language",
      "name",
      "subject",
      "template-body"
    ]
  },
  {
    "name": "mfa backup-codes generate",
    "family": "mfa",
    "summary": "Mint a fresh set of MFA backup codes, invalidating existing ones.",
    "details": "Shown once.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "mfa backup-codes list",
    "family": "mfa",
    "summary": "Returns { remaining: <count> } only -- the codes themselves are shown once, at generate.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "mfa backup-codes use",
    "family": "mfa",
    "summary": "Consume one MFA backup code.",
    "positional": "<userId> <code>",
    "details": "Anonymous endpoint, hence the explicit userId.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "code",
      "user-id"
    ]
  },
  {
    "name": "mfa config get",
    "family": "mfa",
    "summary": "Read the tenant's MFA policy.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "mfa config save",
    "family": "mfa",
    "summary": "Save the tenant's MFA policy.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "allow-backup-codes",
      "allow-user-opt-out",
      "backup-codes-count",
      "body",
      "enable",
      "exempt-roles",
      "file",
      "require-for-all-users",
      "required-roles",
      "user-mfa-type"
    ]
  },
  {
    "name": "mfa disable",
    "family": "mfa",
    "summary": "Disable MFA for the impersonated user.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "mfa generate",
    "family": "mfa",
    "summary": "Send an OTP challenge; returns an mfaId to pass to resend/verify.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "mfa-type",
      "send-phone-number-as-email-domain"
    ]
  },
  {
    "name": "mfa method set",
    "family": "mfa",
    "summary": "Switch the impersonated user's active MFA method.",
    "details": "IAM only branches on 1 (TOTP) and 2 (Email) here -- any other value falls through to its disable path and turns the user's MFA off. Use 'blocks mfa disable' when that is what you mean.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "mfa-type"
    ]
  },
  {
    "name": "mfa resend",
    "family": "mfa",
    "summary": "Re-send a pending OTP challenge for an existing mfaId.",
    "positional": "<mfaId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "mfa-id",
      "send-phone-number-as-email-domain"
    ]
  },
  {
    "name": "mfa totp enable",
    "family": "mfa",
    "summary": "Composed enrollment: totp setup -> (scan the printed QR/secret, enter the code -- interactively prompted if --code is omitted) -> totp...",
    "details": "Composed enrollment: totp setup -> (scan the printed QR/secret, enter the code -- interactively prompted if --code is omitted) -> totp verify-setup -> method set --mfa-type <n> -> backup-codes generate. One sitting, one confirmation. Non-interactive callers must pass --code or receive interactive_input_required. --mfa-type is required and not defaulted: pass IAM UserMfaType 1 for TOTP (the same value plain mfa method set expects).",
    "scope": "project",
    "mutating": true,
    "flags": [
      "code",
      "mfa-type"
    ]
  },
  {
    "name": "mfa totp setup",
    "family": "mfa",
    "summary": "Start TOTP enrollment for the impersonated user.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "mfa totp verify-setup",
    "family": "mfa",
    "summary": "Confirm TOTP enrollment.",
    "positional": "<code>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "code"
    ]
  },
  {
    "name": "mfa verify",
    "family": "mfa",
    "summary": "Verify an OTP or step-up challenge.",
    "positional": "<mfaId> <code>",
    "details": "--auth-type is the UserMfaType that issued it.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "auth-type",
      "code",
      "from-token-call",
      "mfa-id"
    ]
  },
  {
    "name": "new web",
    "family": "new",
    "summary": "Create a Vite React starter app that talks to Blocks exclusively through @seliseblocks/client (a single createBlocksClient() instance) using the...",
    "positional": "<name>",
    "details": "Create a Vite React starter app that talks to Blocks exclusively through @seliseblocks/client (a single createBlocksClient() instance) using the SDK hosted IdP flow: blocksClient.auth.idp.redirectToProvider() on login click and blocksClient.auth.idp.callback() on /login/callback. Includes route guards, auto-refresh through auth.oidc.refreshToken(), live auth/iam/localization SDK examples, a Profile landing page, environment config, and safe .gitignore defaults. Uses the selected project (see 'use') unless --x-blocks-key overrides it. --app-domain and --client-id are resolved from the project when omitted: if the project has one domain it's used automatically, otherwise you're prompted to choose; the OIDC client is picked from a list of the project's existing clients, or you can create a minimal one (display name + redirect URI, active, registered as a Blocks OIDC identity provider) on the spot, or skip and register one later from the portal or 'auth oidc-clients save'. Non-interactive callers must provide --app-domain and --client-id or receive interactive_input_required. When a client id resolves, the command checks AuthController and may enable OIDC login. In non-interactive runs, pass --yes only after approving that possible tenant mutation; failure stops before scaffold files are written. If --blocks-api-url is omitted, it is derived from the app domain: https://blocksapi.<registrable-domain> (for example, app domain https://dqrsf.slsblx.com uses https://blocksapi.slsblx.com). Pass a different Data/IAM/Localization/OS gateway URL explicitly only if your project uses a non-default one. --oidc-url defaults to https://iam.seliseblocks.com.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "app-domain",
      "blocks-api-url",
      "client-id",
      "dev-port",
      "oidc-url",
      "x-blocks-key"
    ]
  },
  {
    "name": "notification delete",
    "family": "notification",
    "summary": "Delete a notification channel configuration.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "notification get",
    "family": "notification",
    "summary": "Read one notification channel configuration.",
    "positional": "<itemId>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "id"
    ]
  },
  {
    "name": "notification list",
    "family": "notification",
    "summary": "List notification channel configurations.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "filter",
      "page",
      "page-size",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "notification save",
    "family": "notification",
    "summary": "Pass --update when saving over an existing notification configuration.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "channel",
      "enable-persistence",
      "file",
      "name",
      "notify-method",
      "type",
      "update"
    ]
  },
  {
    "name": "notifier list",
    "family": "notifier",
    "summary": "List the signed-in user's notifications (GetNotifications).",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "filter",
      "page",
      "page-size",
      "sort-by",
      "sort-desc",
      "unread-only"
    ]
  },
  {
    "name": "notifier mark-all-read",
    "family": "notifier",
    "summary": "Mark every notification as read for the caller.",
    "scope": "project",
    "mutating": true,
    "flags": []
  },
  {
    "name": "notifier mark-read",
    "family": "notifier",
    "summary": "Mark one notification as read.",
    "positional": "<id>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "id"
    ]
  },
  {
    "name": "notifier notify",
    "family": "notifier",
    "summary": "Push a notification to specific users/roles, or everyone matching a subscription filter.",
    "details": "Target with at least one of --user-ids/--roles/--subscription-filters.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "configuration-name",
      "connection-id",
      "content-available",
      "denormalized-payload",
      "file",
      "response-key",
      "response-value",
      "roles",
      "save-denormalized-payload-as-object",
      "subscription-filters",
      "user-ids"
    ]
  },
  {
    "name": "notifier unread",
    "family": "notifier",
    "summary": "Read unread notifications matching a subscription filter.",
    "details": "Sent as query parameters even though swagger documents this endpoint as GET with a JSON body -- the Fetch spec forbids a body on GET. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "action-name",
      "context",
      "order-by",
      "user-id",
      "value"
    ]
  },
  {
    "name": "projects create",
    "family": "projects",
    "summary": "Create a new Blocks project via /os/v4/Project/Create using the account token (no project needs to be selected yet).",
    "positional": "<name>",
    "details": "Creates exactly one application, always in the 'dev' environment -- environment, domain, cookie domain, and production flag are fixed and not configurable here; the domain sent is a placeholder the platform discards and replaces with the one it assigns. Confirms first because it accepts the Blocks terms on your behalf. Refuses a name already used by another project unless --allow-duplicate-name is passed. Verifies the result against Project/Gets and prints the new tenantId, tenantGroupId, and assigned domain. Does not select the project -- run 'blocks use <tenantId>' next. If the account is in project mode, temporarily stops that session for the account-level create call and restores it afterward.",
    "scope": "account",
    "mutating": true,
    "flags": [
      "allow-duplicate-name",
      "name"
    ]
  },
  {
    "name": "projects get",
    "family": "projects",
    "summary": "Read one project from Project/Gets.",
    "positional": "[tenantId]",
    "details": "Uses selected project when tenantId is omitted. Pass --deployment to also include the environment, tenantGroupId, and linked repo assets (from Project/GetAsset) that 'release deploy' uses to resolve its target. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "deployment"
    ]
  },
  {
    "name": "projects list",
    "family": "projects",
    "summary": "List accessible Blocks projects via /os/v4/Project/Gets.",
    "details": "Uses the impersonated project session when a project is selected, otherwise the account token. Read-only.",
    "scope": "local",
    "mutating": false,
    "flags": []
  },
  {
    "name": "release builds list",
    "family": "release",
    "summary": "Paged builds of one repository, addressed by name or id.",
    "positional": "[repo]",
    "details": "Resolves the repo from Build/repos-list: explicit name or id wins, else the single registered repo; multiple repos with no selector fail with repo_ambiguous listing the candidates (never an interactive prompt). --branch filters, --page (1-based) and --page-size (default 30) page through Build/repo-details, and totalCount travels with each page. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "branch",
      "page",
      "page-size",
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release deploy",
    "family": "release",
    "summary": "Deploy the selected project's environment (Build/manual), optionally syncing secrets and setting the domain first.",
    "details": "Resolves the repo from --repo (name or id via Build/repos-list) or, when omitted, in order: (1) this workspace's blocks.json repo binding matched against Build/repos-list on the environment branch, (2) the single Build/repos-list entry whose branch equals the environment, (3) the project's linked OS assets (Project/GetAsset) as a legacy fallback. Labels the choice as repoSource: explicit | workspace-binding | repos-list-match | project-asset. Aborts with repo_ambiguous when multiple env-branch matches exist and none is the workspace binding; repo_not_linked when nothing matches (nextStep suggests git init/connect or --repo). Aborts if the connected branch doesn't match this environment's name. --with-secrets <dotenvFile> first runs release secrets sync for that file and folds its summary into the final document as secretsSync; --domain also sets the custom deployment domain before deploying. --wait polls the build's status FIELD until a server terminal value (Succeeded/Failed/Cancelled/...; or --timeout elapses, default 900s); --follow implies --wait and streams build events to stderr. All progress goes to stderr, so --json stdout stays one parseable verdict document ({buildId, status, verdict, build, repoSource}). Mutating; no artifact upload is performed by this CLI.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "domain",
      "follow",
      "poll-interval",
      "register-callback",
      "repo",
      "timeout",
      "wait",
      "with-secrets"
    ]
  },
  {
    "name": "release domain set",
    "family": "release",
    "summary": "Set a repo's custom deployment domain (Build/repo-update).",
    "positional": "<domain>",
    "details": "Resolves the repo from --repo (name or id) or the single registered repo. Uses the project's environment as projectEnv. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "domain",
      "register-callback",
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release git branches",
    "family": "release",
    "summary": "List branches of one source repository of the connected account.",
    "positional": "<owner/repo>",
    "details": "--provider defaults to github, the only active provider. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "provider",
      "source-repo"
    ]
  },
  {
    "name": "release git repos",
    "family": "release",
    "summary": "Browse repositories of the connected source-control account.",
    "details": "--provider names the VCS and defaults to github -- the only provider active in blocks-release today; anything else fails with provider_not_supported (no rename needed when more providers go live). --search filters; --page (1-based) and --page-size (default 30) page. Requires the GitHub account to be connected from the Blocks portal. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "page",
      "page-size",
      "provider",
      "search"
    ]
  },
  {
    "name": "release logs",
    "family": "release",
    "summary": "Print a build's stored pipeline events (Clone/Build/Deploy/Sast/Sca stages).",
    "positional": "<buildId>",
    "details": "Events come from GET Build (no extra endpoint). --group filters to one stage. --follow keeps polling and streaming new events until the build's status field is terminal; in --json mode streamed lines go to stderr and stdout ends with one {buildId, events, status, verdict} document. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "build-id",
      "follow",
      "group",
      "poll-interval",
      "timeout"
    ]
  },
  {
    "name": "release monitor list",
    "family": "release",
    "summary": "Monitoring/alerting entries for one deployed repo.",
    "details": "Resolves the repo from --repo/--repo-id or the single registered repo. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release repo get",
    "family": "release",
    "summary": "One registered repo's details plus its most recent builds, addressed by name or id.",
    "positional": "<repo>",
    "details": "Output is {repo, recentBuilds (up to 5), totalBuilds}. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release reports get",
    "family": "release",
    "summary": "Security scan report for one build: SAST (SonarQube), SCA (Dependency-Track), or DAST.",
    "positional": "<buildId>",
    "details": "--type is required and must be one of the server's report types: sast (SonarQube), sca-container (Dependency-Track, container image), sca-libraries (Dependency-Track, library manifests), or dast. Anything else fails with invalid_report_type before any request. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "build-id",
      "type"
    ]
  },
  {
    "name": "release repos list",
    "family": "release",
    "summary": "List the repositories registered in blocks-release for the selected project.",
    "details": "Compact mapped rows: repoId, name, branch, deploymentType, lastDeploymentStatus, lastDeploymentDate, url (custom over default), namespace, repoUrl. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "release secrets audit",
    "family": "release",
    "summary": "Audit trail of a repo's secret set (saves, locks, audited value reads).",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets delete",
    "family": "release",
    "summary": "Soft-delete a repo's WHOLE secret set (recoverable with release secrets restore).",
    "details": "The vault value is retained server-side, so restore undoes this. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets list",
    "family": "release",
    "summary": "Secret-set metadata for one repo (RepoSecret/get).",
    "details": "Metadata only -- the server never returns key names or values on this endpoint. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets lock",
    "family": "release",
    "summary": "Lock a repo's secret set against changes.",
    "details": "Resolves the repo from --repo/--repo-id or the single registered repo. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets restore",
    "family": "release",
    "summary": "Restore a repo's soft-deleted secret set.",
    "details": "Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets sync",
    "family": "release",
    "summary": "Bulk env-var upsert into a repo's secret set from a dotenv file.",
    "details": "The server stores ONE whole secret set per repo (RepoSecret/save replaces the set), so merge mode reads the current set first -- an audited read, same as the portal's reveal -- and merges the file over it; nothing is ever removed without --prune, which makes the file the entire set and lists the removed key names in the plan. Only the server's not-found answer (no set yet) starts from empty; any other read failure aborts with secrets_read_failed before saving, so a transient error can never wipe the set. --file defaults to .env; --repo/--repo-id picks the repo (auto when only one is registered). Output and --dry-run show key NAMES and counts only -- values are never displayed. A no-change run reports upToDate without calling save. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "file",
      "prune",
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release secrets unlock",
    "family": "release",
    "summary": "Unlock a repo's secret set.",
    "details": "Resolves the repo from --repo/--repo-id or the single registered repo. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "release settings list",
    "family": "release",
    "summary": "Hosting providers, regions, and machine configs valid for 'release setup'.",
    "details": "Mapped from Build/settings: providers with nested regions and machineConfigs (ids plus names/specs), so setup flags can be chosen in one read. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "release setup",
    "family": "release",
    "summary": "First-time deploy of a registered repo (Build/run-build): creates the deployment namespace and push webhook.",
    "positional": "[repo]",
    "details": "Replaces the portal's Configure Deployment modal. Resolves the repo by name or id (auto-picked when only one is registered) and --hosting-provider/--region/--machine-config by name or id against Build/settings; all three are optional (server defaults apply). Refuses when the repo's linked branch doesn't match this project's environment. --wait/--follow behave as in release deploy. Re-deploys of an already-configured repo belong to 'release deploy'. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "follow",
      "hosting-provider",
      "machine-config",
      "poll-interval",
      "region",
      "register-callback",
      "repo",
      "repo-id",
      "timeout",
      "wait"
    ]
  },
  {
    "name": "release status",
    "family": "release",
    "summary": "Read one build's status plus a stable verdict (succeeded/failed/running) derived from the status field.",
    "positional": "<buildId>",
    "details": "Output is {buildId, status, verdict, build}. --wait polls the status field until a server terminal value (progress on stderr); --follow implies --wait and also streams build events to stderr. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "build-id",
      "follow",
      "poll-interval",
      "timeout",
      "wait"
    ]
  },
  {
    "name": "release teardown",
    "family": "release",
    "summary": "DELETE a repo's live deployment: cancels in-flight builds and deletes the Kubernetes namespace.",
    "positional": "<repo>",
    "details": "Destructive and not undoable, so the repo must be named EXPLICITLY (name or id) -- there is deliberately no fall-back to 'the only repo'. The confirmation states the namespace and served URL being destroyed; --dry-run prints the target first. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "repo",
      "repo-id"
    ]
  },
  {
    "name": "secrets access",
    "family": "secrets",
    "summary": "Set which users and roles may read a secret's value.",
    "positional": "<secretId>",
    "details": "The server replaces the access list, so the default mode does too. --merge reads the current list first and adds --user-ids/--roles to it; --clear sends empty lists (no per-secret restriction). Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "clear",
      "merge",
      "roles",
      "secret-id",
      "user-ids"
    ]
  },
  {
    "name": "secrets audit",
    "family": "secrets",
    "summary": "Paged audit trail of the secret store: every set, value read, rotation, lock, delete, access change, denial.",
    "positional": "[secretId]",
    "details": "Filters: the secret (positional or --secret-id), --action (Set, GetValue, Rotate, Lock, Delete, UpdateAccess, AccessDenied, ...), --actor-user-id, --from/--to (ISO dates); --page is 1-based, --page-size defaults to 20. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "action",
      "actor-user-id",
      "from",
      "page",
      "page-size",
      "secret-id",
      "to"
    ]
  },
  {
    "name": "secrets delete",
    "family": "secrets",
    "summary": "Soft-delete a secret (recoverable with secrets restore).",
    "positional": "<secretId>",
    "details": "Metadata is marked deleted and the vault value retained, so 'secrets restore' undoes it; 'secrets list --include-deleted' still shows it. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "secret-id"
    ]
  },
  {
    "name": "secrets get",
    "family": "secrets",
    "summary": "One secret's metadata: name, status, access list, rotation history, canReadValue.",
    "positional": "<secretId>",
    "details": "Never returns the value; no command does. Unknown ids fail with secret_not_found. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "secret-id"
    ]
  },
  {
    "name": "secrets list",
    "family": "secrets",
    "summary": "Paged metadata of the project's secrets.",
    "details": "Filters: --search, --status active|locked|deleted, --include-deleted, --organization-id; --page is 1-based and --page-size defaults to 20. Returns {data, totalCount}; never a value. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "include-deleted",
      "organization-id",
      "page",
      "page-size",
      "search",
      "status"
    ]
  },
  {
    "name": "secrets lock",
    "family": "secrets",
    "summary": "Lock a secret: value reads and rotations are refused until it is unlocked.",
    "positional": "<secretId>",
    "details": "Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "secret-id"
    ]
  },
  {
    "name": "secrets restore",
    "family": "secrets",
    "summary": "Restore a soft-deleted secret.",
    "positional": "<secretId>",
    "details": "Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "secret-id"
    ]
  },
  {
    "name": "secrets rotate",
    "family": "secrets",
    "summary": "Replace a secret's value in place; id, access list and audit trail stay.",
    "positional": "<secretId>",
    "details": "The new value comes from exactly one of --value-file, --value-env or --value, redacted in --dry-run output. Refused on a locked or deleted secret (409 invalid_state). Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "secret-id",
      "value",
      "value-env",
      "value-file"
    ]
  },
  {
    "name": "secrets set",
    "family": "secrets",
    "summary": "Create one secret and return its secretId.",
    "positional": "<name>",
    "details": "Always creates: names are not unique server-side, so re-running makes a second secret -- change an existing value with 'secrets rotate' and metadata with 'secrets update'. The value comes from exactly one of --value-file (whole file content, one trailing newline stripped), --value-env (an environment variable name) or --value; the first two keep it out of shell history. The type is fixed (there is no flag); --user-ids/--roles set the initial access list. The value is redacted in --dry-run output and never printed. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "description",
      "file",
      "name",
      "organization-id",
      "roles",
      "user-ids",
      "value",
      "value-env",
      "value-file"
    ]
  },
  {
    "name": "secrets set-many",
    "family": "secrets",
    "summary": "Create one secret per KEY=value line of a dotenv file.",
    "details": "Each key becomes a secret name; the response maps every name to its new secretId. Always creates (re-running duplicates). --description/--organization-id apply to all; the type is fixed. Dry-run lists the names and redacts the values. Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "description",
      "env-file",
      "organization-id"
    ]
  },
  {
    "name": "secrets unlock",
    "family": "secrets",
    "summary": "Unlock a locked secret.",
    "positional": "<secretId>",
    "details": "Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "secret-id"
    ]
  },
  {
    "name": "secrets update",
    "family": "secrets",
    "summary": "Rename or re-describe a secret; the value is untouched.",
    "positional": "<secretId>",
    "details": "At least one of --name/--description is required (secret_update_empty otherwise). Mutating.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "description",
      "name",
      "secret-id"
    ]
  },
  {
    "name": "storage config delete",
    "family": "storage",
    "summary": "Delete a storage backend configuration.",
    "positional": "<name>",
    "scope": "project",
    "mutating": true,
    "flags": [
      "name"
    ]
  },
  {
    "name": "storage config get",
    "family": "storage",
    "summary": "Read one storage backend configuration by name.",
    "positional": "<name>",
    "scope": "project",
    "mutating": false,
    "flags": [
      "name"
    ]
  },
  {
    "name": "storage config list",
    "family": "storage",
    "summary": "List storage backend configurations.",
    "scope": "project",
    "mutating": false,
    "flags": []
  },
  {
    "name": "storage config save",
    "family": "storage",
    "summary": "Upsert: omit --item-id to create; pass --update to update.",
    "details": "Once a configuration exists (by --item-id with --update, or a create whose --name is taken) only the upload settings change: --upload-url-expiry-seconds, --download-url-expiry-seconds, --max-file-size-bytes (max 50 MB) and --upload-completion-required-for. Those four are carried from the stored record, since the server resets any left out. Provider and credential flags are refused on an existing configuration because the server would drop them.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-key",
      "body",
      "connection-string",
      "download-url-expiry-seconds",
      "file",
      "host",
      "item-id",
      "max-file-size-bytes",
      "name",
      "password",
      "port",
      "region-endpoint",
      "remote-base-path",
      "secret-key",
      "strategy",
      "update",
      "upload-completion-required-for",
      "upload-url-expiry-seconds",
      "username"
    ]
  },
  {
    "name": "use",
    "family": "use",
    "summary": "Save the selected project tenant for the resolved account and in blocks.json, then immediately impersonate it.",
    "positional": "<project-tenant-id>",
    "details": "If a different project was selected, stops that impersonation first to reclaim a fresh account refresh token before starting the new one.",
    "scope": "local",
    "mutating": false,
    "flags": []
  }
];
