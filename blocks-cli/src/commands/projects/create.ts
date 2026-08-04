import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { parseCommand } from "../../lib/workspace.js";
import { requestContext } from "../../lib/request-context.js";

export async function createProject(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = args[0] || stringFlag(flags, "name", { required: true });
  const env = stringFlag(flags, "env", { defaultValue: "dev" });
  const domain = stringFlag(flags, "domain", { defaultValue: `https://${slug(name)}-${env}.seliseblocks.com` });
  const cookieDomain = stringFlag(flags, "cookie-domain", { defaultValue: "seliseblocks.com" });
  const production = booleanFlag(flags, "production");

  const body = {
    name,
    isAcceptBlocksTerms: true,
    isUseBlocksExclusively: true,
    isProduction: production,
    resources: [],
    applicationContexts: [
      {
        cookieDomain,
        domain,
        environment: env
      }
    ]
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create Blocks project '${name}' with '${env}' environment.`);
  const result = await blocksRequest<unknown>("/os/v4/Project/Create", {
    accountAuth: true,
    ...requestContext(flags),
    body
  });
  writeOutput(result, flags);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "blocks-app";
}
