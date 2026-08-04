import { randomUUID } from "node:crypto";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyTranslateKeys(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const keyIds = listFlag(flags, "key-ids") ?? args;
  if (!keyIds.length) throw new Error("Provide key ids as arguments or --key-ids a,b.");

  const defaultLanguage = stringFlag(flags, "default-language", { required: true });
  const messageCoRelationId = stringFlag(flags, "message-co-relation-id", { defaultValue: randomUUID() });
  const projectTenantId = await selectedProject(flags);
  const projectKey = stringFlag(flags, "project-key", { defaultValue: projectTenantId });
  const body = { defaultLanguage, keyIds, messageCoRelationId, projectKey };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/TranslateKeys", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Translate ${keyIds.length} localization key(s) from default language '${defaultLanguage}'.`);
  const result = await blocksRequest<unknown>("/localization/v4/Key/TranslateKeys", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
