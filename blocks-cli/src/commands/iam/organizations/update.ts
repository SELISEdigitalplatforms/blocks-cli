import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamOrganizationsUpdate(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const id = args[0] || stringFlag(flags, "id", { required: true });
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      currency: stringFlag(flags, "currency") || undefined,
      description: stringFlag(flags, "description") || undefined,
      email: stringFlag(flags, "email") || undefined,
      industry: stringFlag(flags, "industry") || undefined,
      isEnable: optionalBooleanFlag(flags, "is-enabled"),
      locale: stringFlag(flags, "locale") || undefined,
      name: stringFlag(flags, "name") || undefined,
      phoneNumber: stringFlag(flags, "phone-number") || undefined,
      timeZone: stringFlag(flags, "time-zone") || undefined,
      websiteUrl: stringFlag(flags, "website-url") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: `/iam/v4/iam/organizations/${id}`, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Update IAM organization '${id}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`/iam/v4/iam/organizations/${encodeURIComponent(id)}`, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
