import { optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Cloud-storage upload path, step 1 of 2: get a pre-signed URL, then PUT the file bytes to it
 * with `data:files:upload-to-url`. For local-storage-backed projects use
 * `data:files:upload-to-local-storage` instead (single call, no presign step).
 */
export async function dataFilesPresignedUploadUrl(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      accessModifier: stringFlag(flags, "access-modifier") || undefined,
      configurationName: stringFlag(flags, "configuration-name") || undefined,
      metaData: stringFlag(flags, "meta-data") || undefined,
      moduleName: optionalIntegerFlag(flags, "module-name"),
      name: stringFlag(flags, "name", { required: true }),
      parentDirectoryId: stringFlag(flags, "parent-directory-id"),
      tags: stringFlag(flags, "tags") || undefined
    })
  };

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/GetPreSignedUrlForUpload", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
