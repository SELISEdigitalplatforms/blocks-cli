import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamOrganizationsConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      allowOrgCreationFromCloud: booleanFlag(flags, "allow-org-creation-from-cloud") || undefined,
      allowOrgCreationFromConstruct: booleanFlag(flags, "allow-org-creation-from-construct") || undefined,
      allowOrgCreationFromPortal: booleanFlag(flags, "allow-org-creation-from-portal") || undefined,
      allowOrgCreationFromSignup: booleanFlag(flags, "allow-org-creation-from-signup") || undefined,
      consentForMultiOrgEnable: booleanFlag(flags, "consent-for-multi-org-enable") || undefined,
      isMultiOrgEnabled: booleanFlag(flags, "multi-org-enabled") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/organizations/config", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save IAM organization configuration for the selected project.");
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/iam/v4/iam/organizations/config", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
