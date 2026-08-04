import { integerFlag, optionalBooleanFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function localizationKeyGetTimeline(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectTenantId = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/localization/v4/Key/GetTimeline", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId,
    query: {
      "CreateDateRange.EndDate": stringFlag(flags, "create-date-end") || undefined,
      "CreateDateRange.StartDate": stringFlag(flags, "create-date-start") || undefined,
      EntityId: stringFlag(flags, "entity-id") || undefined,
      IsDescending: optionalBooleanFlag(flags, "sort-desc"),
      PageNumber: integerFlag(flags, "page-number", 1),
      PageSize: integerFlag(flags, "page-size", 20),
      SortProperty: stringFlag(flags, "sort-by") || undefined,
      UserId: stringFlag(flags, "user-id") || undefined
    }
  });
  writeOutput(result, flags);
}
