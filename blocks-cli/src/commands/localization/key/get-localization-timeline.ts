import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetLocalizationTimeline(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetLocalizationTimeline", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: {
      "CreateDateRange.EndDate": stringFlag(flags, "create-date-end") || undefined,
      "CreateDateRange.StartDate": stringFlag(flags, "create-date-start") || undefined,
      ExcludeLogFromValues: listFlag(flags, "exclude-log-from-values"),
      IsDescending: optionalBooleanFlag(flags, "sort-desc"),
      LogFrom: stringFlag(flags, "log-from") || undefined,
      LogFromValues: listFlag(flags, "log-from-values"),
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      SortProperty: stringFlag(flags, "sort-by") || undefined,
      UserId: stringFlag(flags, "user-id") || undefined
    }
  });
  writeOutput(result, flags);
}
