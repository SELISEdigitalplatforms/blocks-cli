import { booleanFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { compact, jsonBodyFlag } from "../../../lib/json-flag.js";
import { carryCurrent, findInList } from "../../../lib/merge-current.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationLanguageSave(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const overrides = {
    ...(await jsonBodyFlag(flags)),
    ...compact({
      isDefault: optionalBooleanFlag(flags, "is-default"),
      itemId: stringFlag(flags, "item-id") || undefined,
      languageCode: stringFlag(flags, "language-code") || undefined,
      languageName: stringFlag(flags, "language-name") || undefined
    })
  };

  if (!overrides.languageName) throw new Error("Provide --language-name (or set it in --body/--file).");

  const projectTenantId = await selectedProject(flags);

  // Language/Save upserts by LanguageName and assigns IsDefault from the request, a
  // non-nullable bool -- re-saving the default language without --is-default silently
  // demoted it, leaving the tenant with no default. There is no GET by name, so the
  // current record comes from the list. The match is exact (case included) because the
  // server's own lookup is a Mongo Eq: a differently-cased name is a CREATE there, and
  // carrying this record's isDefault into it would mint a second default language.
  const existing = findInList(
    await blocksRequest<unknown>("/localization/v4/Language/Gets", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId
    }),
    (item) => item.languageName === overrides.languageName
  );
  const current = carryCurrent(existing, ["itemId", "languageCode", "isDefault"]);

  const body = { ...current, ...overrides };
  if (!body.languageCode) throw new Error("Provide --language-code (or set it in --body/--file).");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/localization/v4/Language/Save", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Save language '${body.languageName}' (${body.languageCode}).`);
  const result = await blocksRequest<unknown>("/localization/v4/Language/Save", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
