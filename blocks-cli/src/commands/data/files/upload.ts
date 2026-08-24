import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { booleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

const CONTENT_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".webp": "image/webp",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip"
};

/**
 * Composed upload: create the file/version metadata and PUT cloud bytes, or use the
 * one-call local-storage path. The upload is immediately part of the object tree.
 */
export async function dataFilesUpload(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const filePath = stringFlag(flags, "file", { required: true });
  const name = stringFlag(flags, "name") || basename(filePath);

  if (booleanFlag(flags, "local-storage")) {
    await uploadToLocalStorage(filePath, name, flags);
    return;
  }

  await uploadViaPresignedUrl(filePath, name, flags);
}

async function uploadToLocalStorage(filePath: string, name: string, flags: Record<string, string | boolean>): Promise<void> {
  const parentDirectoryId = stringFlag(flags, "parent-id") || stringFlag(flags, "parent-directory-id");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/files/upload-file-to-local-storage", file: filePath, name }, flags);
    return;
  }

  await confirmMutation(flags, `Upload '${filePath}' to local storage as '${name}'.`);
  const form = new FormData();
  form.set("File", new Blob([await readFile(filePath)]), name);
  form.set("Name", name);
  if (parentDirectoryId) form.set("ParentDirectoryId", parentDirectoryId);

  const itemId = stringFlag(flags, "item-id");
  if (itemId) form.set("ItemId", itemId);
  const tags = stringFlag(flags, "tags");
  if (tags) form.set("Tags", tags);
  const accessModifier = stringFlag(flags, "access-modifier");
  if (accessModifier) form.set("AccessModifier", accessModifier);
  const configurationName = stringFlag(flags, "configuration-name");
  if (configurationName) form.set("ConfigurationName", configurationName);

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/files/upload-file-to-local-storage", {
    body: form,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

async function uploadViaPresignedUrl(filePath: string, name: string, flags: Record<string, string | boolean>): Promise<void> {
  const parentDirectoryId = stringFlag(flags, "parent-id") || stringFlag(flags, "parent-directory-id");
  const contentType = stringFlag(flags, "content-type") || CONTENT_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
  const tags = stringFlag(flags, "tags");

  const presignBody = compact({
    accessModifier: stringFlag(flags, "access-modifier") || undefined,
    configurationName: stringFlag(flags, "configuration-name") || undefined,
    itemId: stringFlag(flags, "item-id") || undefined,
    metaData: stringFlag(flags, "meta-data") || undefined,
    moduleName: optionalIntegerFlag(flags, "module-name"),
    name,
    parentDirectoryId: parentDirectoryId || undefined,
    tags: tags || undefined
  });

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        steps: [
          { body: presignBody, endpoint: "/data/v4/files/get-pre-signed-url-for-upload" },
          { contentType, endpoint: "PUT <uploadUrl>", file: filePath }
        ]
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Upload '${filePath}' as '${name}' (create metadata + PUT bytes).`);
  const projectKey = await selectedProject(flags);

  const presigned = await blocksRequest<Record<string, unknown>>("/data/v4/files/get-pre-signed-url-for-upload", {
    body: presignBody,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });

  const uploadUrl = firstString(presigned, ["uploadUrl", "url", "preSignedUrl"]);
  const fileId = firstString(presigned, ["fileId", "itemId", "fileStorageId"]);
  if (!uploadUrl || !fileId) {
    throw new Error(
      `Presigned URL response did not include a recognizable uploadUrl/fileId. Check the response and consider running the individual steps manually: ${JSON.stringify(presigned)}`
    );
  }

  const bytes = await readFile(filePath);
  const putResponse = await fetch(uploadUrl, {
    body: bytes,
    headers: { "Content-Type": contentType, "x-ms-blob-type": "BlockBlob" },
    method: "PUT"
  }).catch((error: Error) => {
    throw new Error(`Upload PUT failed: ${error.message}`);
  });

  if (!putResponse.ok) {
    throw new Error(`Upload PUT ${putResponse.status} ${putResponse.statusText}: ${await putResponse.text().catch(() => "")}`);
  }

  writeOutput({ fileId, uploadUrl, uploaded: true }, flags);
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return undefined;
}
