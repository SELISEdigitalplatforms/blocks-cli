---
name: blocks-data-storage
description: "Store and serve files on a SELISE Blocks project entirely through the @seliseblocks/client SDK's data.files / data.dms namespaces — there is no blocks-os CLI support for storage/DMS at all. Covers the upload pipeline (data.files.presignedUploadUrl → data.files.uploadToUrl for cloud storage, or data.files.uploadToLocalStorage for local-storage-backed deployments → data.dms.uploadFiles to register the file in a DMS folder), reading files back (data.files.get/getMany/info, data.dms.list), deleting (data.files.delete), attaching searchable metadata (data.files.updateAdditionalInfo), and folder management (data.dms.createFolder/deleteFolder). Use whenever the user wants to upload, download, browse, organize, tag, or delete FILES/attachments/documents/images/PDFs on Blocks from app code — 'upload a PDF and get a download link', 'attach an image to a record', 'let users download this file', 'create a folder and list its contents', 'get a presigned upload URL', 'register an uploaded file in a document folder'. This is separate from the data model: to define schemas use blocks-data-gateway-configuration, and to CRUD records use blocks-data-gateway-crud (store a file here, keep its fileId in a schema field there)."
---

# Blocks Data — Storage (Files / DMS)

Storage is DMS (document management system), reached through the `data.files` and `data.dms` namespaces of `@seliseblocks/client` — `BlocksDataClient` in `blocks-packages/blocks-client/src/data/data-client.ts`. There is **no `blocks-os` CLI support for storage or DMS** (confirmed against `blocks-cli-os` — it has no storage commands at all), so unlike schema/rules work this skill never routes through the CLI: every action here is a direct SDK call from app code.

**Prerequisite:** a project is selected and a frontend is scaffolded. If login/project state is unknown, or there's no app to write this code into yet, run **[blocks-onboarding](../blocks-onboarding/SKILL.md)** first — it gets `blocks-os new web` scaffolding in place (React 18 + TypeScript + Vite + Tailwind + Radix + TanStack Query + a single `@seliseblocks/client` instance). Everything below assumes that scaffold's shared client, conventionally exported as `blocksClient` from `src/lib/blocks/client.ts`.

```ts
import { blocksClient } from "../lib/blocks/client";
const { files, dms } = blocksClient.data;
```

Store a file here and keep its returned `fileId` in a schema field (see **[blocks-data-gateway-crud](../blocks-data-gateway-crud/SKILL.md)**) to associate it with a record.

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

- **No CLI path, ever.** If a user asks for a `blocks-os` command for uploading or listing files, there isn't one — this is 100% SDK, always write/run a small script or app code against `blocksClient.data.files`/`.dms`.
- **`moduleName` and `parentDirectoryId` on `presignedUploadUrl`** — the SDK types mark them optional, but the underlying endpoint may require them for a given project/storage setup. Confirm the expected `moduleName` with the project's storage configuration, and send `parentDirectoryId` as a string (`""` for root) when the endpoint requires a parent folder value.
- **The pre-signed PUT is the one call with no Blocks auth.** `uploadToUrl` sends no `x-blocks-key` and no bearer token by design — everything else in this skill (`presignedUploadUrl`, `uploadToLocalStorage`, `dms.*`, `files.get`/`getMany`/`info`/`delete`) is a normal authenticated Blocks API call.
- **Upload ≠ visible in a folder.** `uploadToUrl`/`uploadToLocalStorage` only gets the bytes stored; call `dms.uploadFiles` afterward if the file needs to appear under a DMS folder.
- **Most file/DMS methods return `Promise<unknown>`.** The SDK doesn't hand you a typed response for this surface — check the actual JSON shape at runtime (e.g. log the presign response once) rather than assuming field names beyond what's documented here.
- **`accessModifier`** is `"Public"` (readable without auth) or `"Private"` — decide per file, not per project.
- Don't confuse this with the data model: a file's `fileId` is just a string you store in a schema field via **blocks-data-gateway-crud**; this skill never touches schemas.

## Example trigger prompts

- "Upload a PDF and get a download link."
- "Attach an image to this record." (upload here, then store the `fileId` via blocks-data-gateway-crud)
- "Let users download this file from the app."
- "Create a folder and list its contents."
- "Get a presigned upload URL for a cloud storage upload."
- "This deployment uses local storage — how do I upload a file?"
- "Tag this uploaded file with a status so it's searchable later."
- "Delete this file / delete this folder."
