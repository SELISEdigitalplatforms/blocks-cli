import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { redactSecrets } from "../../../lib/redact.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";
import { STORAGE_SECRET_FIELDS } from "./secret-fields.js";

export async function storageConfigGet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0] || stringFlag(flags, "name", { required: true });
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Storage/Get", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: { ConfigurationName: name }
  });
  // blocks-os returns each secret as a status only (<field>Status: none|active|locked|archived|
  // missing|unavailable), never a value. Redact anyway, as a second guard against an older
  // blocks-os that echoed AWS keys back: this output is routinely pasted into issues and CI logs.
  writeOutput(redactSecrets(result, STORAGE_SECRET_FIELDS), flags);
}
