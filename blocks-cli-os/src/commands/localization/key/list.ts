import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);
  const overrides = await jsonBodyFlag(flags);

  const createDateStart = stringFlag(flags, "create-date-start") || undefined;
  const createDateEnd = stringFlag(flags, "create-date-end") || undefined;
  const lastUpdateDateStart = stringFlag(flags, "last-update-date-start") || undefined;
  const lastUpdateDateEnd = stringFlag(flags, "last-update-date-end") || undefined;

  const body = {
    ...overrides,
    ...compact({
      createDateRange: createDateStart || createDateEnd ? { endDate: createDateEnd, startDate: createDateStart } : undefined,
      glossaryId: stringFlag(flags, "glossary-id") || undefined,
      isDescending: optionalBooleanFlag(flags, "sort-desc"),
      isPartiallyTranslated: optionalBooleanFlag(flags, "is-partially-translated"),
      keySearchText: stringFlag(flags, "key-search-text") || undefined,
      lastUpdateDateRange: lastUpdateDateStart || lastUpdateDateEnd ? { endDate: lastUpdateDateEnd, startDate: lastUpdateDateStart } : undefined,
      missingLanguages: listFlag(flags, "missing-languages"),
      moduleIds: listFlag(flags, "module-ids"),
      pageNumber: integerFlag(flags, "page-number", 1),
      pageSize: integerFlag(flags, "page-size", 20),
      searchKey: stringFlag(flags, "search-key") || undefined,
      sortProperty: stringFlag(flags, "sort-by") || undefined
    })
  };

  const result = await blocksRequest<unknown>("/localization/v4/Key/Gets", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId
  });
  writeOutput(result, flags);
}
