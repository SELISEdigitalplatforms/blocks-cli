import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailTemplateSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      imageId: stringFlag(flags, "image-id") || undefined,
      imageUrl: stringFlag(flags, "image-url") || undefined,
      itemId: stringFlag(flags, "item-id") || undefined,
      jsonContent: stringFlag(flags, "json-content") || undefined,
      language: stringFlag(flags, "language") || undefined,
      mailConfigurationId: stringFlag(flags, "configuration-id") || undefined,
      name: stringFlag(flags, "name") || undefined,
      templateBody: stringFlag(flags, "template-body") || undefined,
      templateSubject: stringFlag(flags, "subject") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Mail/SaveTemplate", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save mail template '${body.name ?? body.itemId ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Mail/SaveTemplate", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
