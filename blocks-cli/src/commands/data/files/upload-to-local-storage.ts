import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * The one-call alternative to presigned-upload-url + upload-to-url, for projects backed
 * by local storage (not cloud object storage). Sends multipart/form-data with the file bytes.
 */
export async function dataFilesUploadToLocalStorage(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const filePath = stringFlag(flags, "file", { required: true });
  const name = stringFlag(flags, "name") || basename(filePath);
  const additionalPropertiesRaw = stringFlag(flags, "additional-properties");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/data/v4/Files/UploadFileToLocalStorage", name, request: { file: filePath } }, flags);
    return;
  }

  await confirmMutation(flags, `Upload '${filePath}' to local storage as '${name}'.`);
  const form = new FormData();
  form.set("File", new Blob([await readFile(filePath)]), name);
  form.set("Name", name);
  form.set("ParentDirectoryId", stringFlag(flags, "parent-directory-id"));

  const itemId = stringFlag(flags, "item-id");
  if (itemId) form.set("ItemId", itemId);
  const metaData = stringFlag(flags, "meta-data");
  if (metaData) form.set("MetaData", metaData);
  const tags = stringFlag(flags, "tags");
  if (tags) form.set("Tags", tags);
  const accessModifier = stringFlag(flags, "access-modifier");
  if (accessModifier) form.set("AccessModifier", accessModifier);
  const configurationName = stringFlag(flags, "configuration-name");
  if (configurationName) form.set("ConfigurationName", configurationName);

  if (additionalPropertiesRaw) {
    const parsed = JSON.parse(additionalPropertiesRaw) as Record<string, string>;
    for (const [key, value] of Object.entries(parsed)) form.set(`AdditionalProperties[${key}]`, value);
  }

  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/data/v4/Files/UploadFileToLocalStorage", {
    body: form,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
