import { stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { withPermissionHint } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export const EMAIL_AVAILABLE_PERMISSION = "blocks-iam::iam::email-available";

export async function iamEmailAvailable(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const email = args[0] || stringFlag(flags, "email", { required: true });
  const projectKey = await selectedProject(flags);

  // A protected action since IAM 2026-10-14 (it was anonymous, and an anonymous call is answered
  // for whichever tenant x-blocks-key names -- the root tenant for an impersonated session). With
  // the token validated, the impersonated session scopes the check to the project like any other
  // IAM read. POST, since the GET form is deprecated for putting addresses in URLs.
  const result = await withPermissionHint(EMAIL_AVAILABLE_PERMISSION, blocksRequest<unknown>("/iam/v4/iam/email/available", {
    body: { email },
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  }));
  writeOutput(result, flags);
}
