import { readFile } from "node:fs/promises";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { redactUrlSecrets } from "../../../lib/redact.js";
import { parseCommand } from "../../../lib/workspace.js";

/**
 * Step 2 of the cloud-storage upload path (after `data:files:presigned-upload-url`).
 * This PUTs straight to the storage provider's pre-signed URL - no `x-blocks-key`, no
 * bearer token, not a Blocks API call. Adds `x-ms-blob-type: BlockBlob` by default
 * (Azure block-blob upload header); pass --blob-type to override or --no-blob-type-header
 * to omit it entirely for non-Azure providers.
 */
export async function dataFilesUploadToUrl(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const url = stringFlag(flags, "url", { required: true });
  const filePath = stringFlag(flags, "file", { required: true });
  const contentType = stringFlag(flags, "content-type", { required: true });
  const blobType = stringFlag(flags, "blob-type", { defaultValue: "BlockBlob" });
  const skipBlobTypeHeader = flags["no-blob-type-header"] === true;

  if (booleanFlag(flags, "dry-run")) {
    // The pre-signed URL carries its own time-limited write credential in the
    // query string (an Azure SAS token, an S3 X-Amz-Signature). It is not a
    // Blocks token, but it is a usable one, and a dry-run is the output most
    // likely to be pasted into a log or a chat -- so show where the upload is
    // going without reprinting the signature.
    writeOutput({ dryRun: true, file: filePath, url: redactUrlSecrets(url) }, flags);
    return;
  }

  await confirmMutation(flags, `Upload '${filePath}' to the pre-signed URL.`);
  const body = await readFile(filePath);
  const headers: Record<string, string> = { "Content-Type": contentType };
  if (!skipBlobTypeHeader && blobType) headers["x-ms-blob-type"] = blobType;

  const response = await fetch(url, { body, headers, method: "PUT" }).catch((error: Error) => {
    throw new Error(`Upload PUT failed: ${error.message}`);
  });

  if (!response.ok) {
    throw new Error(`Upload PUT ${response.status} ${response.statusText}: ${await response.text().catch(() => "")}`);
  }

  writeOutput({ ok: true, status: response.status }, flags);
}
