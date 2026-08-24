---
name: blocks-data-storage
description: "Build file and document-management features on SELISE Blocks Data: upload/download, directory trees, cursor-paginated browsing and search, file versions, rename/move/copy, soft delete/trash/restore, sharing, access policies, and inheritance. Use for attachments, file browsers, folders, shared files, permissions, or version history. Use 'blocks data files *' for terminal/admin work and @seliseblocks/client data.files/data.directories/data.objects for app code."
---

# Blocks Data — Storage

Treat storage as one permission-aware object tree containing **directories** and **files**. Uploading a new file now creates the file object in that tree; there is no second DMS registration step.

Use:

- **`blocks data files *`** for supported terminal/admin operations.
- **`@seliseblocks/client`** for app code. Use the shared `blocksClient` created by blocks-onboarding.
- **blocks-storage-configuration** only to manage the named provider configuration used by `configurationName`.

Select a project first with `blocks use <tenantId>`. If login/project state or the shared client setup is unknown, use blocks-onboarding before this skill.

Store the returned `fileId` in a Data record when attaching a file to domain data. Use blocks-data-gateway-crud for the record mutation.

## Choose the surface

The current CLI and SDK follow the backend's file, directory, and object resource groups.

```bash
blocks --version
blocks data files --help
```

- Use `blocks data files *` for terminal/admin work and inspect `blocks --help` for exact flags.
- Use `blocksClient.data.files` for bytes, metadata, versions, and file operations.
- Use `blocksClient.data.directories` for directory create/get/update/delete/move.
- Use `blocksClient.data.objects` for browse/search/trash/shared/restore/share/access/inheritance.

Legacy `data.dms.*`, `dms-upload`, `dms-list`, `create-folder`, and `delete-folder` wrappers are retired. Uploads need no registration call.

## Upload a new file

Choose one path from the project's storage configuration.

| Provider category | Sequence |
|---|---|
| Cloud object storage | request a pre-signed URL, then PUT the bytes to it |
| Local/SFTP storage | send one authenticated multipart upload |

Both paths create the file object and initial version directly. Do not call `dms-upload` afterward.

### Cloud upload from the CLI

Prefer the composed command. It previews and confirms both metadata creation and the provider PUT:

```bash
blocks data files upload --file ./invoice.pdf --parent-id <directoryId> \
  --configuration-name Default --access-modifier Private --dry-run --json
blocks data files upload --file ./invoice.pdf --parent-id <directoryId> \
  --configuration-name Default --access-modifier Private --yes --json
```

Use the two explicit commands only when the intermediate upload URL is required:

```bash
blocks data files presigned-upload-url \
  --name invoice.pdf \
  --parent-directory-id <directoryId> \
  --configuration-name Default \
  --access-modifier Private \
  --dry-run --json
blocks data files presigned-upload-url \
  --name invoice.pdf \
  --parent-directory-id <directoryId> \
  --configuration-name Default \
  --access-modifier Private \
  --yes --json

blocks data files upload-to-url \
  --url "<uploadUrl>" \
  --file ./invoice.pdf \
  --content-type application/pdf \
  --dry-run --json
blocks data files upload-to-url \
  --url "<uploadUrl>" \
  --file ./invoice.pdf \
  --content-type application/pdf \
  --yes --json
```

The presign response contains `uploadUrl`, `fileId`, and `isSuccess`. The first call creates the file metadata/version; the PUT fills its object-storage key. Handle PUT failure explicitly because it can leave metadata for missing bytes.

When `parentDirectoryId` is empty, the cloud upload resolves `moduleName` to that module's default directory. The backend default is module value `8` (`Default_Construct`), but pass the intended module or a concrete directory id instead of relying on that default.

### Cloud upload from app code

```ts
const presign = await blocksClient.data.files.presignedUploadUrl({
  name: "invoice.pdf",
  parentDirectoryId: directoryId,
  configurationName: "Default",
  accessModifier: "Private",
  tags: "invoice,2026",
});

if (!presign || typeof presign !== "object") {
  throw new Error("Unexpected upload response");
}

const result = presign as {
  uploadUrl: string;
  fileId: string;
  isSuccess: boolean;
  errors?: Record<string, string>;
};

if (!result.isSuccess) throw new Error(JSON.stringify(result.errors));

await blocksClient.data.files.uploadToUrl({
  url: result.uploadUrl,
  body: file,
  contentType: file.type || "application/octet-stream",
});
```

`uploadToUrl` is provider-direct and sends no bearer token or `x-blocks-key`. The SDK adds Azure's `x-ms-blob-type: Blockblob` header unless overridden; ensure that header matches the signed provider policy.

### Local-storage upload

```bash
blocks data files upload-to-local-storage \
  --file ./invoice.pdf \
  --parent-directory-id <directoryId> \
  --configuration-name Default \
  --access-modifier Private \
  --dry-run --json
blocks data files upload-to-local-storage \
  --file ./invoice.pdf \
  --parent-directory-id <directoryId> \
  --configuration-name Default \
  --access-modifier Private \
  --yes --json
```

```ts
const uploaded = await blocksClient.data.files.uploadToLocalStorage({
  name: file.name,
  file,
  parentDirectoryId: directoryId,
  configurationName: "Default",
  accessModifier: "Private",
  tags: ["invoice", "2026"],
});
```

This call creates the file object and uploads version 1 in one request. Unlike cloud presign, an empty local `parentDirectoryId` stays at the top level; it is not resolved through `moduleName`.

## Add a file version

Supplying an existing `itemId` to either upload flow creates another version after the caller passes the file's Edit check. For cloud storage, the dedicated command/method returns another pre-signed URL:

```bash
blocks data files versions <fileId> --limit 25 --json
blocks data files create-version <fileId> --configuration-name Default --dry-run --json
blocks data files create-version <fileId> --configuration-name Default --yes --json
```

```ts
const history = await blocksClient.data.files.versions({ fileId, limit: 25 });
const next = await blocksClient.data.files.createVersion({ fileId, configurationName: "Default" });
```

Version history is newest-first and cursor-paginated. Use the returned opaque `nextCursor`; the current backend uses the last version number internally, but callers must not construct cursors. Limits are 1–100, default 25.

## Read and download

```bash
blocks data files get <fileId> --configuration-name Default --json
blocks data files get <fileId> --version <versionNo> --configuration-name Default --json
blocks data files get-many <fileId...> --configuration-name Default --json
```

```ts
const file = await blocksClient.data.files.get(fileId, {
  configurationName: "Default",
  version: 2,
});
```

The response includes a download URL plus metadata. Download requires the caller's Download permission. Access-denied reads may deliberately look like missing resources so clients cannot probe hidden object ids.

## Directory and object workflows

For browsing, directories, search, move/copy/rename, trash, sharing, and ACL behavior, read [flows/object-management.md](flows/object-management.md).

## Update custom metadata

```bash
blocks data files update-additional-info <fileId> \
  --additional-properties '{"status":"reviewed"}' \
  --dry-run --json
blocks data files update-additional-info <fileId> \
  --additional-properties '{"status":"reviewed"}' \
  --yes --json
```

This updates `additionalProperties`; it does not rename, move, tag, or version the file.

## Delete safely

Deletion now distinguishes trash from permanent removal:

- `permanent: false` archives the file or directory so it can be restored.
- `permanent: true` removes it for good.
- The backend default is **`true`** when `permanent` is omitted.

The CLI defaults to safe soft deletion. Add `--permanent` only after explicit approval.

```bash
blocks data files delete <fileId> --dry-run --json
blocks data files delete <fileId> --yes --json
blocks data files delete <fileId> --permanent --dry-run --json
```

In app code, send the choice explicitly: `blocksClient.data.files.delete({ fileId, permanent: false })`.

## Permission model

Every storage request passes two checks:

1. The endpoint permission permits that class of action.
2. The object ACL permits the action on that specific file/directory.

Capabilities are ordered: `View`, `Download`, `Edit`, `Delete`, `Manage`, `Owner`. Higher capabilities imply lower ones. Directory children inherit ancestor access while `inheritsParentAccess` is true. New files inherit from their directory.

Do not infer permission from a visible button or endpoint grant. Render actions from each object's returned `permissions` flags and still handle 403/404 races.

## Gotchas

- Upload now creates the visible file object; legacy DMS registration is wrong and may fail after the bytes were successfully PUT.
- Cloud presign creates metadata before the provider PUT. Treat the two steps as a recoverable workflow and surface partial failure.
- A name must contain an allowed extension. Directories may restrict extensions.
- Names are unique within a directory. File move/copy can fail on a name conflict or extension policy.
- `Private` is the safe default. Use `Public` only when unauthenticated download is intended.
- `configurationName` selects an existing provider record; it does not configure storage.
- Most legacy file SDK methods return `Promise<unknown>`; validate responses at the boundary.
- Never send Blocks auth headers to a pre-signed provider URL.
- Never use a raw API call to work around a missing CLI/SDK wrapper; update the client surface first.

## Example triggers

- "Upload this PDF into the Contracts folder."
- "Build a file browser with folders and search."
- "Show files shared with the current user."
- "Move this file to trash and let users restore it."
- "Add version history and upload a replacement version."
- "Share this directory with a role and let its children inherit access."
- "Move, copy, or rename a file."
