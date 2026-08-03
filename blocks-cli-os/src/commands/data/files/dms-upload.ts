import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Registers an already-uploaded file (via presigned-upload-url/upload-to-url or
 * upload-to-local-storage) so it shows up in a DMS folder. `--file-storage-id` covers the
 * common single-file case; pass --body/--file with an `upload` array to register several at once.
 */
export async function dataFilesDmsUpload(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const fileStorageId = stringFlag(flags, "file-storage-id");
  const body: { upload?: unknown[] } = await jsonBodyFlag(flags);

  if (fileStorageId) {
    body.upload = [compact({
      artifactName: stringFlag(flags, "artifact-name") || undefined,
      fileStorageId,
      parentId: stringFlag(flags, "parent-id"),
      tags: listFlag(flags, "tags")
    })];
  }

  if (!Array.isArray(body.upload) || !body.upload.length) {
    throw new Error("Provide --file-storage-id (with --artifact-name) or an 'upload' array via --body/--file.");
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/Files/UploadFile", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Register ${body.upload.length} file(s) into DMS.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/UploadFile", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
