import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamEmailAvailable(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const email = args[0] || stringFlag(flags, "email", { required: true });
  const projectKey = await selectedProject(flags);

  // An anonymous action: IAM answers for whichever tenant x-blocks-key names and ignores the
  // token. The impersonated session's x-blocks-key is the root tenant, so the check ran
  // against platform accounts -- "not available" for an address the project doesn't have.
  // Sent as the app sends it instead, keyed to the project; POST, since the GET form is
  // deprecated for putting addresses in URLs.
  const result = await blocksRequest<unknown>("/iam/v4/iam/email/available", {
    anonymousTenantId: projectKey,
    ...requestContext(flags),
    body: { email }
  });
  writeOutput(result, flags);
}
