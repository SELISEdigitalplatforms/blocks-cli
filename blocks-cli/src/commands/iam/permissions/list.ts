import { booleanFlag, zeroBasedPage, integerFlag, optionalBooleanFlag, optionalIntegerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { compact, jsonBodyFlag, listFlag } from "../../../lib/json-flag.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

export async function iamPermissionsList(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const sortBy = stringFlag(flags, "sort-by");

  const filter = {
    ...(await jsonBodyFlag(flags)).filter as Record<string, unknown> | undefined,
    ...compact({
      isArchived: optionalBooleanFlag(flags, "is-archived"),
      // GetPermissionFilter.IsBuiltIn is a STRING of "yes"/"no" server-side, not a
      // boolean: the repository compares `IsBuiltIn.ToLower() == "yes"`. Sending a
      // JSON boolean failed to bind the whole body ("The JSON value could not be
      // converted to System.String"), which is why the 400 also claimed the `query`
      // parameter was missing. Like Search, it is non-nullable, so it must always be
      // present, and blank means "no filter".
      isBuiltIn: builtInFilter(flags),
      permissionSeverity: optionalIntegerFlag(flags, "severity"),
      resourceGroup: stringFlag(flags, "resource-group") || undefined,
      resources: listFlag(flags, "resources"),
      // Required and non-nullable server-side; "" is the unfiltered value.
      search: stringFlag(flags, "search") ?? "",
      tags: listFlag(flags, "tags"),
      type: optionalIntegerFlag(flags, "type")
    })
  };

  const body = {
    filter,
    organizationId: stringFlag(flags, "organization-id") || undefined,
    page: zeroBasedPage(flags),
    pageSize: integerFlag(flags, "page-size", 20),
    roles: listFlag(flags, "roles"),
    sort: sortBy ? {
      isDescending: booleanFlag(flags, "sort-desc"),
      property: sortBy
    } : undefined
  };

  const result = await blocksRequest<unknown>("/iam/v4/iam/permissions", {
    body,
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

/**
 * Maps `--is-built-in` onto IAM's "yes"/"no" string filter. Accepts the bare flag
 * (`--is-built-in`), an explicit `--is-built-in=false`, and the literal strings the
 * API itself uses, so both the documented boolean spelling and a raw "yes"/"no" work.
 * Returns "" when the flag is absent, which the repository reads as "no filter".
 */
function builtInFilter(flags: Record<string, string | boolean>): string {
  if (!("is-built-in" in flags)) return "";
  const raw = flags["is-built-in"];
  if (typeof raw === "string") {
    const normalized = raw.trim().toLowerCase();
    if (normalized === "") return "";
    if (["yes", "true", "1"].includes(normalized)) return "yes";
    if (["no", "false", "0"].includes(normalized)) return "no";
    throw new Error('--is-built-in must be one of: yes, no, true, false');
  }
  return raw ? "yes" : "no";
}
