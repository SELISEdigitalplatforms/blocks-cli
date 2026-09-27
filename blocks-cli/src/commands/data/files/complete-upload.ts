import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { verificationStatusName } from "../../../lib/data-files.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Cloud-storage upload path, step 3 when the presign response said
 * `uploadCompletionRequired`: blocks-data verifies the quarantined bytes (declared size,
 * content type, checksum, real file type) and promotes them, or rejects them. Idempotent --
 * a second call returns the outcome already recorded. A version that never required
 * completion answers `file_version_not_found`.
 */
export async function dataFilesCompleteUpload(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const fileId = args[0] || stringFlag(flags, "file-id", { required: true });
  const fileVersionId = args[1] || stringFlag(flags, "file-version-id", { required: true });
  const body = { fileId, fileVersionId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/files/complete-upload", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Complete upload of file '${fileId}' version '${fileVersionId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<Record<string, unknown>>("/data/v4/files/complete-upload", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput({ ...result, verificationStatus: verificationStatusName(result.verificationStatus) ?? result.verificationStatus }, flags);
}
