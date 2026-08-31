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
    "details": "Fetches and merges current values first. Enabling OIDC requires accountActionBaseUrl.",
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
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "collection-name-editable",
      "collection-name-pattern",
      "connection-string",
      "database-name",
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
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-modifier",
      "body",
      "configuration-name",
      "file",
      "item-id",
      "meta-data",
      "module-name",
      "name",
      "parent-directory-id",
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
    "summary": "Cloud: create file/version metadata, then PUT bytes to the returned URL.",
    "details": "Local: one multipart request. The file appears in the object tree without registration.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-modifier",
      "configuration-name",
      "content-type",
      "file",
      "item-id",
      "local-storage",
      "meta-data",
      "module-name",
      "name",
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
      "item-id",
      "meta-data",
      "name",
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
    "summary": "Create or update the field-level validation rules on a schema field.",
    "details": "Upsert: omit --item-id to create, pass it to update. --body must include a \"validations\" array, e.g. '{\"validations\":[{\"type\":1,\"value\":\"^[0-9]+$\",\"isActive\":true}]}'.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "body",
      "field-name",
      "file",
      "item-id",
      "schema-id"
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
    "details": "Boolean flags only turn settings on; use --body to switch one off.",
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
      "multi-org-enabled"
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
      "page-size",
      "sort-by",
      "sort-desc"
    ]
  },
  {
    "name": "iam users update",
    "family": "iam",
    "summary": "Update an existing IAM user's profile fields, roles, or permissions.",
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
      "permissions",
      "phone-number",
      "roles"
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
    "scope": "project",
    "mutating": true,
    "flags": [
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
    "details": "Upsert: omit --configuration-id to create; pass it to update. --provider and --port are raw integers. --account-password is redacted from dry-run output, but the live response and the stored value are still sensitive.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "account-password",
      "body",
      "configuration-id",
      "enable-ssl",
      "file",
      "host",
      "inbound",
      "name",
      "port",
      "provider",
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
    "name": "release builds get",
    "family": "release",
    "summary": "Alias for release status.",
    "positional": "<buildId>",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "build-id"
    ]
  },
  {
    "name": "release builds list",
    "family": "release",
    "summary": "List Release build details for a repository using an impersonated project token.",
    "positional": "[repoId]",
    "details": "When repoId is omitted, resolves it from the selected project's linked repo assets (Project/GetAsset, preferring project auth) -- auto-picked if there's exactly one, otherwise you're prompted to choose. Non-interactive callers must pass repoId/--repo-id or receive interactive_input_required. Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "repo-id"
    ]
  },
  {
    "name": "release deploy",
    "family": "release",
    "summary": "Deploy the selected project's environment.",
    "details": "Resolves everything from state you already have: the repo linked to this project (Project/GetAsset) and that repo's connected branch (Build/repo-details) -- no --repo-id needed. Aborts if the connected branch doesn't match this environment's name. Pass --domain to also set the custom deployment domain before deploying. Pass --wait to poll release status on the resulting build until it reaches a terminal state (or --timeout elapses, default 900s) instead of returning immediately with just a build id. Mutating; no artifact upload is performed by this CLI.",
    "scope": "project",
    "mutating": true,
    "flags": [
      "domain",
      "poll-interval",
      "timeout",
      "wait"
    ]
  },
  {
    "name": "release status",
    "family": "release",
    "summary": "Read Release build status by build id using an impersonated project token.",
    "positional": "<buildId>",
    "details": "Read-only.",
    "scope": "project",
    "mutating": false,
    "flags": [
      "build-id"
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
    "scope": "project",
    "mutating": true,
    "flags": [
      "access-key",
      "body",
      "connection-string",
      "file",
      "host",
      "item-id",
      "name",
      "password",
      "port",
      "region-endpoint",
      "remote-base-path",
      "secret-key",
      "strategy",
      "update",
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
