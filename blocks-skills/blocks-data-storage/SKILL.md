---
name: blocks-data-storage
description: "Store and serve files on a SELISE Blocks project. Two paths: the blocks-os CLI (data files * — presigned-upload-url/upload-to-url/upload-to-local-storage, get/get-many/info, dms-list/dms-upload, create-folder/delete-folder, update-additional-info, delete) for admin work and one-off scripting, or the @seliseblocks/client SDK's data.files/data.dms namespaces for wiring uploads/downloads into app code (React components, forms). Covers the upload pipeline (presigned URL for cloud storage, or a single local-storage call), reading files back, deleting, attaching searchable metadata, and folder management. Use whenever the user wants to upload, download, browse, organize, tag, or delete FILES/attachments/documents/images/PDFs on Blocks — 'upload a PDF and get a download link', 'attach an image to a record', 'let users download this file', 'create a folder and list its contents', 'get a presigned upload URL', 'register an uploaded file in a document folder'. This is separate from the data model: to define schemas use blocks-data-gateway-configuration, and to CRUD records use blocks-data-gateway-crud (store a file here, keep its fileId in a schema field there)."
---

# Blocks Data — Storage (Files / DMS)

Storage is DMS (document management system). Two ways to reach it, pick based on what the user is actually doing:

- **`blocks-os data files *` (CLI)** — admin tasks, one-off scripts, or anything the user is doing from a terminal/agent context rather than inside a running app. Talks to `/data/v4/Files/*` directly.
- **`@seliseblocks/client`'s `data.files` / `data.dms` namespaces (SDK)** — wiring upload/download/browse into actual app code (a React component, a form submit handler). `BlocksDataClient` in `blocks-packages/blocks-client/src/data/data-client.ts`.

Both call the same underlying endpoints; which one to use is about *where the code runs*, not a capability gap — unlike some other Data resources, this one has full CLI coverage.

**Prerequisite:** a project is selected (`blocks-os use <tenantId>`). For the SDK path, a frontend also needs to be scaffolded. If login/project state is unknown, or there's no app to write SDK code into yet, run **[blocks-onboarding](../blocks-onboarding/SKILL.md)** first — it gets `blocks-os new web` scaffolding in place (React 18 + TypeScript + Vite + Tailwind + Radix + TanStack Query + a single `@seliseblocks/client` instance). The SDK examples below assume that scaffold's shared client, conventionally exported as `blocksClient` from `src/lib/blocks/client.ts`.

```ts
import { blocksClient } from "../lib/blocks/client";
const { files, dms } = blocksClient.data;
```

Store a file here and keep its returned `fileId` in a schema field (see **[blocks-data-gateway-crud](../blocks-data-gateway-crud/SKILL.md)**) to associate it with a record.

## CLI quick reference

```bash
# Cloud storage (pre-signed URL), two steps
blocks-os data files presigned-upload-url --name invoice.pdf --access-modifier Public --json
blocks-os data files upload-to-url --url "<uploadUrl from above>" --file ./invoice.pdf --content-type application/pdf --yes --json

# Local storage, one step
blocks-os data files upload-to-local-storage --file ./invoice.pdf --access-modifier Public --yes --json

# Register the uploaded file in a DMS folder (upload alone doesn't do this)
blocks-os data files dms-upload --file-storage-id <fileId> --artifact-name invoice.pdf --yes --json

# Read it back
blocks-os data files dms-list --parent-id "" --json
blocks-os data files get <fileId> --json

# Folders, metadata, cleanup
blocks-os data files create-folder Invoices --yes --json
blocks-os data files update-additional-info <fileId> --additional-properties '{"status":"reviewed"}' --yes --json
blocks-os data files delete <fileId> --yes --json
```

Same two upload paths as the SDK section below (pick based on the project's storage backend, not per-call), same `--dry-run`-before-`--yes` discipline as every other `blocks-os` mutation.

## Two upload paths — pick one per deployment

A project's storage is backed by either cloud object storage (Azure Blob, S3, etc.) or local storage on the Blocks Data host. Which one applies is a property of the project's storage configuration, not something the frontend chooses per call — but the SDK exposes a distinct method for each:

| Deployment | Call sequence |
|---|---|
| **Cloud storage** (pre-signed URL) | `files.presignedUploadUrl(...)` → `files.uploadToUrl(...)` |
| **Local storage** | `files.uploadToLocalStorage(...)` (one call, no presign step) |

Both are followed by the same registration step, `dms.uploadFiles(...)`, if the file needs to show up in a DMS folder.

## Step 1a (cloud) — get a pre-signed upload URL

```ts
const presign = await files.presignedUploadUrl({
  name: "invoice.pdf",
  contentType: "application/pdf",
  configurationName: "Default",       // example only — confirm the storage config name for this project
  moduleName: 3,                      // example only — confirm the module value expected by this project
  parentDirectoryId: "",              // required — "" for root, or a folder id; never omit/null
  accessModifier: "Public"            // "Public" (readable without auth) or "Private"
});
```

This is `POST /data/v4/Files/GetPreSignedUrlForUpload`. It returns the pre-signed `uploadUrl` plus a `fileId` you'll need for the next steps — the method's return type is `Promise<unknown>`, so read the exact response shape at runtime rather than assuming a typed contract. Note `contentType` in this request is not forwarded to the presign call itself (the normalizer drops it); pass it again to `uploadToUrl` below so the PUT gets the right `Content-Type` header. Treat `configurationName` and `moduleName` values as project-specific unless the tenant's storage configuration says otherwise.

## Step 1b (cloud) — PUT the binary to that URL

```ts
await files.uploadToUrl({
  url: presign.uploadUrl,
  body: fileBlob,              // Blob | ArrayBuffer | ArrayBufferView | ReadableStream
  contentType: "application/pdf"
});
```

This is the one call in the whole skill that is **provider-direct, not a Blocks API call** — it sends **no `x-blocks-key` and no bearer token**. It PUTs straight to the storage provider's pre-signed URL (`this.http.external`, not `this.http.request`). If you don't set your own `x-ms-blob-type` header, the SDK adds `x-ms-blob-type: Blockblob` for you (Azure's block-blob upload header); verify that this matches the storage provider and signed-URL policy for the project rather than assuming every provider ignores extra headers.

## Step 1 (local storage) — the one-call alternative

For local-storage-backed deployments, skip the presign/PUT pair entirely and upload straight through Blocks Data:

```ts
await files.uploadToLocalStorage({
  name: "invoice.pdf",
  file: fileBlob,               // Blob | File
  configurationName: "Default",
  parentDirectoryId: "",
  accessModifier: "Public",
  tags: ["invoice", "2026"]
});
```

This is `POST /data/v4/Files/UploadFileToLocalStorage` — the SDK builds a multipart `FormData` body for you (`File`, `Name`, `ItemId`, `MetaData`, `ParentDirectoryId`, `Tags`, `AccessModifier`, `ConfigurationName`, `AdditionalProperties[key]`) and sends it as a normal authenticated Blocks API call (`x-blocks-key` + bearer, unlike the pre-signed PUT above).

## Step 2 — register the file in a DMS folder

Neither upload path above makes a file appear in a document folder by itself — that's a separate registration call:

```ts
await dms.uploadFiles({
  upload: [{
    fileStorageId: presign.fileId,   // the fileId from presignedUploadUrl (or the equivalent id from uploadToLocalStorage's response)
    artifactName: "invoice.pdf",
    parentId: "",                    // "" for root, or a folder id
    tags: ["invoice"]
  }]
});
```

This is `POST /data/v4/Files/UploadFile` — despite the name, this is the DMS *registration* call, not the binary upload. `upload` is an array, so multiple files can be registered into folders in one call.

## Step 3 — read it back

```ts
const folder = await dms.list({ parentId: "", take: 20 });          // POST /data/v4/Files/GetDmsFileAndFolder
const meta = await files.get(presign.fileId, { configurationName: "Default" }); // GET /data/v4/Files/GetFile
```

`dms.list` returns the combined folder+file listing for a `parentId` (`""` = root), with `searchKey`/`skip`/`take` for search and paging. The same endpoint is also reachable as `files.listFolder(...)` — they're identical calls, `dms.list` is the more discoverable name for folder-browsing UI. `files.get` confirms a specific upload landed: a successful response with a non-null `url` (download link) and matching `name`/size means the file is stored.

## Other file operations

- **`files.getMany({ fileIds, configurationName })`** — batch read (`POST /Files/GetFiles`) instead of one `files.get` per attachment.
- **`files.info({ page, pageSize, sort, filter })`** — paged file metadata/listing (`POST /Files/GetFilesInfo`) for storage-browser UIs; unlike `presignedUploadUrl`, the SDK does not remap these field names to PascalCase — pass exactly what your app builds.
- **`files.updateAdditionalInfo({ itemId, additionalProperties })`** — attach searchable metadata to an uploaded file, e.g. a business reference or workflow status (`POST /Files/updateFileAdditionalInfo`).
- **`files.delete({ fileId, configurationName?, eventQueueName? })`** — delete a file (`POST /Files/DeleteFile`).
- **`dms.createFolder({ artifactName, parentId?, configurationName? })`** / **`dms.deleteFolder({ folderId, configurationName? })`** — DMS folder management (`POST /Files/CreateFolder` / `POST /Files/DeleteFolder`).

## Gotchas

- **Terminal/admin task → CLI (`data files *`); app code → SDK.** Both exist and both are fully supported; don't default to writing a throwaway script against the SDK for something the CLI already does in one command, and don't reach for `blocks-os` from inside a React component.
- **`--module-name` / `moduleName` and `--parent-directory-id` / `parentDirectoryId` on the presigned-upload-url call** — optional in the CLI/SDK types, but the underlying endpoint may require them for a given project/storage setup. Confirm the expected module value with the project's storage configuration, and always send a `parentDirectoryId` value (`""` for root) when the endpoint requires a parent folder value — the CLI command defaults it to `""` automatically if you omit `--parent-directory-id`.
- **The pre-signed PUT is the one call with no Blocks auth.** `uploadToUrl` sends no `x-blocks-key` and no bearer token by design — everything else in this skill (`presignedUploadUrl`, `uploadToLocalStorage`, `dms.*`, `files.get`/`getMany`/`info`/`delete`) is a normal authenticated Blocks API call.
- **Upload ≠ visible in a folder.** `uploadToUrl`/`uploadToLocalStorage` only gets the bytes stored; call `dms.uploadFiles` afterward if the file needs to appear under a DMS folder.
- **Most file/DMS methods return `Promise<unknown>`.** The SDK doesn't hand you a typed response for this surface — check the actual JSON shape at runtime (e.g. log the presign response once) rather than assuming field names beyond what's documented here.
- **`accessModifier`** is `"Public"` (readable without auth) or `"Private"` — decide per file, not per project.
- Don't confuse this with the data model: a file's `fileId` is just a string you store in a schema field via **blocks-data-gateway-crud**; this skill never touches schemas.

## Example trigger prompts

- "Upload a PDF and get a download link." → CLI (`data files presigned-upload-url` + `upload-to-url`, or `upload-to-local-storage`) for a one-off; SDK if it's a feature in the app.
- "Attach an image to this record." (upload via CLI or SDK, then store the `fileId` via blocks-data-gateway-crud)
- "Let users download this file from the app." → SDK, this is in-app behavior.
- "Create a folder and list its contents." → `data files create-folder` + `data files dms-list`.
- "Get a presigned upload URL for a cloud storage upload." → `data files presigned-upload-url`.
- "This deployment uses local storage — how do I upload a file?" → `data files upload-to-local-storage`.
- "Tag this uploaded file with a status so it's searchable later." → `data files update-additional-info`.
- "Delete this file / delete this folder." → `data files delete` / `data files delete-folder`.
