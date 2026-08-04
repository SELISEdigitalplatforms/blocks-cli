import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function mailMailboxList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/os/v4/Mail/GetMailBoxMails", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey,
    query: {
      IsInbound: optionalBooleanFlag(flags, "inbound"),
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      SearchText: stringFlag(flags, "search") || undefined,
      "SendDateRange.EndDate": stringFlag(flags, "end-date") || undefined,
      "SendDateRange.StartDate": stringFlag(flags, "start-date") || undefined,
      Status: stringFlag(flags, "status") || undefined
    }
  });
  writeOutput(result, flags);
}
