import { booleanFlag, optionalBooleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamOrganizationsConfigSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  // The four allowOrgCreationFrom* flags are plain bools the server assigns straight from
  // the request, so one left out was stored as false: `--multi-org-enabled true` alone
  // switched off org creation from every channel. Read the current config and merge over
  // it. isOrgNameUniquenessEnabled is nullable (omitted keeps the stored value) and
  // multi-org can only be switched on, once, with consent -- both are safe to send as read.
  const current = carryCurrent(
    await blocksRequest<unknown>("/iam/v4/iam/organizations/config", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }),
    [
      "allowOrgCreationFromCloud", "allowOrgCreationFromConstruct", "allowOrgCreationFromSignup",
      "allowOrgCreationFromPortal", "isMultiOrgEnabled", "consentForMultiOrgEnable"
    ]
  );

  const body = {
    ...current,
    ...(await jsonBodyFlag(flags)),
    ...compact({
      allowOrgCreationFromCloud: optionalBooleanFlag(flags, "allow-org-creation-from-cloud"),
      allowOrgCreationFromConstruct: optionalBooleanFlag(flags, "allow-org-creation-from-construct"),
      allowOrgCreationFromPortal: optionalBooleanFlag(flags, "allow-org-creation-from-portal"),
      allowOrgCreationFromSignup: optionalBooleanFlag(flags, "allow-org-creation-from-signup"),
      consentForMultiOrgEnable: optionalBooleanFlag(flags, "consent-for-multi-org-enable"),
      isMultiOrgEnabled: optionalBooleanFlag(flags, "multi-org-enabled"),
      isOrgNameUniquenessEnabled: optionalBooleanFlag(flags, "org-name-uniqueness")
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/iam/v4/iam/organizations/config", request: body }, flags);
    return;
  }

  await confirmMutation(flags, "Save IAM organization configuration for the selected project.");
  const result = await blocksRequest<unknown>("/iam/v4/iam/organizations/config", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
