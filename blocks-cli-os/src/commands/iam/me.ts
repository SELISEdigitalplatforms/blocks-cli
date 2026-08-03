import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand } from "../../lib/workspace.js";

export async function iamMe(argv: string[] = []): Promise<void> {
  const { flags } = parseCommand(argv);
  const me = await blocksRequest<unknown>("/iam/v4/iam/me", {
    accountAuth: true,
    ...requestContext(flags)
  });

  writeOutput(me, { ...flags, json: true });
}
