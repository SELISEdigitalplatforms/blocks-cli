import { randomUUID } from "node:crypto";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyTranslateKey(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const keyId = args[0] || stringFlag(flags, "key-id", { required: true });
  const defaultLanguage = stringFlag(flags, "default-language", { required: true });
  const messageCoRelationId = stringFlag(flags, "message-co-relation-id", { defaultValue: randomUUID() });
  const body = { defaultLanguage, keyId, messageCoRelationId };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Key/TranslateKey", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Translate localization key '${keyId}' from default language '${defaultLanguage}'.`);
  const projectTenantId = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/localization/v4/Key/TranslateKey", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
