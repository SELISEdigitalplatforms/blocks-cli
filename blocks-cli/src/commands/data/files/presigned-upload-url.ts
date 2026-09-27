import { booleanFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Cloud-storage upload path, step 1 of 2: get a pre-signed URL, then PUT the file bytes to it
 * with `data:files:upload-to-url`. For local-storage-backed projects use
 * `data:files:upload-to-local-storage` instead (single call, no presign step). When the
 * response says `uploadCompletionRequired`, finish with `data:files:complete-upload`
 * using its `fileId` and `fileVersionId`, or the file stays in quarantine.
 */
export async function dataFilesPresignedUploadUrl(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessModifier: stringFlag(flags, "access-modifier") || undefined,
      checksum: stringFlag(flags, "checksum") || undefined,
      checksumAlgorithm: stringFlag(flags, "checksum-algorithm") || undefined,
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      contentType: stringFlag(flags, "content-type") || undefined,
      inheritsParentAccess: optionalBooleanFlag(flags, "inherits-parent-access"),
      itemId: stringFlag(flags, "item-id") || undefined,
      metaData: stringFlag(flags, "meta-data") || undefined,
      moduleName: optionalIntegerFlag(flags, "module-name"),
      name: stringFlag(flags, "name", { required: true }),
      objectAccessLevel: stringFlag(flags, "object-access-level") || undefined,
      parentDirectoryId: stringFlag(flags, "parent-directory-id"),
      sizeInBytes: optionalIntegerFlag(flags, "size-in-bytes"),
      tags: stringFlag(flags, "tags") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/files/get-pre-signed-url-for-upload", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create file metadata and an upload URL for '${body.name}'.`);

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/files/get-pre-signed-url-for-upload", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
