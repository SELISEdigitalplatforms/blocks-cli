import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { BaseOsResponse, OS_DOMAIN_API, upstreamOsMessage } from "../../lib/os-domain.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Sets the tenant cookie/custom domain via POST /os/v4/Domain/Configure.
 * blocks-os returns no echoed domain — the CLI reports the value it sent.
 */
export async function domainConfigure(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const cookieDomain = stringFlag(flags, "cookie-domain").trim();

  if (!cookieDomain) {
    throw new CliActionableError(
      "domain name is missing",
      "domain_missing_required_fields",
      "Pass --cookie-domain <hostname> (e.g. app.example.com)."
    );
  }

  const body = { cookieDomain };
  const endpoint = `${OS_DOMAIN_API}/Configure`;

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Configure cookie domain to '${cookieDomain}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<BaseOsResponse>(endpoint, {
    acceptFailureEnvelope: true,
    body,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });

  if (result?.isSuccess === false) {
    throw new CliActionableError(
      upstreamOsMessage(result, "Domain configure failed."),
      "domain_configure_failed",
      "Check the domain value and your project permissions, then retry."
    );
  }

  writeOutput({ configured: true, cookieDomain }, flags);
}
