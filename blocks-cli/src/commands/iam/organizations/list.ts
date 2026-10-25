import { integerFlag, optionalBooleanFlag, stringFlag, zeroBasedPage } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { isRecord } from "../../../lib/data-response.js";
import { listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

// Upper bound when reading every organization to filter locally (pages of 100).
const MAX_LOCAL_PAGES = 50;

/**
 * GET /iam/organizations pages from 0 (`Skip = PageSize * Page`), so the 1-based --page
 * is converted -- passing it through made the default page skip the first organization.
 *
 * IAM's filter has a non-nullable `Search`: once any `Filter.*` is sent, the filter is
 * bound and an absent (or empty, which binds as null) Search fails with "The Search field
 * is required". The service ignores a blank search anyway, so filters given without
 * --search are applied here instead, over the unfiltered list.
 */
export async function iamOrganizationsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);

  const page = zeroBasedPage(flags);
  const pageSize = integerFlag(flags, "page-size", 20);
  const search = stringFlag(flags, "search") || undefined;
  const ids = listFlag(flags, "ids");
  const isDisabled = optionalBooleanFlag(flags, "is-disabled");
  const parentOrganizationId = stringFlag(flags, "parent-organization-id") || undefined;
  const sort = {
    "Sort.IsDescending": optionalBooleanFlag(flags, "sort-desc"),
    "Sort.Property": stringFlag(flags, "sort-by") || undefined
  };

  const request = (query: Record<string, string | number | boolean | string[] | undefined>) =>
    blocksRequest<unknown>("/iam/v4/iam/organizations", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { ...query, ...sort }
    });

  const hasFilters = Boolean(ids?.length) || isDisabled !== undefined || Boolean(parentOrganizationId);
  if (search || !hasFilters) {
    writeOutput(await request({
      // A list binds from repeated keys; one comma-joined value bound as a single id.
      "Filter.Ids": ids,
      "Filter.IsDisabled": isDisabled,
      "Filter.ParentOrganizationId": parentOrganizationId,
      "Filter.Search": search,
      Page: page,
      PageSize: pageSize
    }), flags);
    return;
  }

  const all: Record<string, unknown>[] = [];
  for (let index = 0; index < MAX_LOCAL_PAGES; index += 1) {
    const response = await request({ Page: index, PageSize: 100 });
    const items = isRecord(response) && Array.isArray(response.organizations) ? response.organizations.filter(isRecord) : [];
    all.push(...items);
    const total = isRecord(response) && typeof response.totalCount === "number" ? response.totalCount : undefined;
    if (items.length < 100 || (total !== undefined && all.length >= total)) break;
  }

  const matching = all.filter((organization) =>
    (!ids?.length || ids.includes(String(organization.itemId ?? organization.id ?? "")))
    && (isDisabled === undefined || Boolean(organization.isDisabled) === isDisabled)
    && (!parentOrganizationId || organization.parentOrganizationId === parentOrganizationId));

  writeOutput({
    organizations: matching.slice(page * pageSize, page * pageSize + pageSize),
    totalCount: matching.length,
    filteredBy: "cli"
  }, flags);
}
