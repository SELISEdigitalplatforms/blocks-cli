import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { compact, jsonBodyFlag, jsonFlag } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

const SECRETS_SAVE_API = "/os/v4/Secrets/Save";

export async function secretsSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const body = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      itemId: stringFlag(flags, "item-id") || undefined,
      keyValuePairs: keyValuePairsFlag(flags),
      secretKey: stringFlag(flags, "secret-key") || undefined
    })
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: SECRETS_SAVE_API, request: redactSecret(body) }, flags);
    return;
  }

  await confirmMutation(flags, `Save secret '${body.secretKey ?? ""}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(SECRETS_SAVE_API, {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

function keyValuePairsFlag(flags: Record<string, string | boolean>): Record<string, string> | undefined {
  const parsed = jsonFlag(flags, "key-value-pairs");
  if (parsed === undefined) return undefined;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--key-value-pairs must be a JSON object, e.g. '{\"isEnable\":\"true\"}'");
  }
  return parsed as Record<string, string>;
}

function redactSecret(body: Record<string, unknown>): Record<string, unknown> {
  const pairs = body.keyValuePairs;
  if (!pairs || typeof pairs !== "object") return body;

  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(pairs as Record<string, string>)) {
    redacted[key] = /secret|password|key$/i.test(key) ? "***" : value;
  }
  return { ...body, keyValuePairs: redacted };
}
