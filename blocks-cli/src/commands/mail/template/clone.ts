import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailTemplateClone(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const body = {
    itemId: id,
    ...compact({
      language: stringFlag(flags, "language") || undefined,
      mailConfigurationId: stringFlag(flags, "configuration-id") || undefined,
      name: stringFlag(flags, "name") || undefined,
      templateSubject: stringFlag(flags, "subject") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/os/v4/Mail/CloneTemplate", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Clone mail template '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/os/v4/Mail/CloneTemplate", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
