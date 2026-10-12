import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { readRulesFile, validateSecurityEntries } from "../../../lib/data-files.js";
import { unwrapDataArray, unwrapSchemaListResponse } from "../../../lib/data-response.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";
import { withGatewayReload } from "../../../lib/data-gateway.js";

type RulesDocument = {
  policies?: unknown;
  security?: unknown;
};

type LocalPolicy = Record<string, unknown> & { policyName?: unknown; schemaName?: unknown };

type LocalSecurity = Record<string, unknown> & { schemaId?: unknown; schemaName?: unknown };

export async function dataRulesDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const dryRun = booleanFlag(flags, "dry-run");
  const rules: RulesDocument = await readRulesFile().catch((error: NodeJS.ErrnoException) => {
    if (dryRun && error.code === "ENOENT") return {};
    throw error;
  });
  const securityErrors = validateSecurityEntries(rules as Record<string, unknown>);
  if (securityErrors.length) throw new Error(`Rules validation failed:\n${securityErrors.join("\n")}`);
  const security = (Array.isArray(rules.security) ? rules.security : []) as LocalSecurity[];
  const policies = (Array.isArray(rules.policies) ? rules.policies : []) as LocalPolicy[];

  if (dryRun) {
    writeOutput({ dryRun: true, policies: policies.length, security: security.length }, flags);
    return;
  }

  await confirmMutation(flags, `Deploy data rules to project '${projectKey}'.`);
  const results: unknown[] = [];

  // Resolve every schema id up front, so a missing schema fails before anything is
  // written rather than after the security entries have already been applied.
  const { schemaIdByName, existingItemIdByKey } = await resolveDestinationContext(security, policies, flags, projectKey);
  const missing = [...new Set([...security, ...policies]
    .map((item) => (typeof item.schemaName === "string" ? item.schemaName : ""))
    .filter((name) => name && !schemaIdByName.has(name)))];
  if (missing.length) {
    throw new Error(`Rules target unknown schema(s) ${missing.map((name) => `'${name}'`).join(", ")} in project '${projectKey}'. Push the schema first; nothing was deployed.`);
  }

  for (const item of security) {
    // A schemaName is resolved in this project, like policies are; that lets
    // `data sync` lock down a schema its own push just created. A bare schemaId is
    // sent as given.
    const { schemaName, ...entry } = item;
    const schemaId = typeof schemaName === "string" && schemaName ? schemaIdByName.get(schemaName) : entry.schemaId;
    results.push(await blocksRequest<unknown>("/data/v4/data-access/security/change", {
      body: { ...entry, schemaId, projectKey },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }));
  }

  if (policies.length) {
    for (const policy of policies) {
      const schemaName = String(policy.schemaName ?? "");
      const policyName = String(policy.policyName ?? "");
      if (!schemaName) throw new Error(`Rule policy '${policyName || "unknown"}' is missing schemaName.`);

      const schemaId = schemaIdByName.get(schemaName);
      if (!schemaId) {
        throw new Error(`Rule policy '${policyName}' targets unknown schema '${schemaName}' in project '${projectKey}'. Push the schema first.`);
      }

      const existingItemId = existingItemIdByKey.get(`${schemaName}::${policyName}`);

      // Fields are mapped explicitly (not spread) because the CLI's portable
      // format and the create/update request DTOs use different names
      // (e.g. entityName vs schemaName) -- see CLAUDE_HANDOFF.md #3.
      if (existingItemId) {
        results.push(await blocksRequest<unknown>("/data/v4/data-access/policy/update", {
          body: {
            fieldNames: policy.fieldNames,
            isAllowPolicy: policy.isAllowPolicy,
            itemId: existingItemId,
            policyDescription: policy.policyDescription,
            policyName,
            priority: policy.priority,
            projectKey,
            ruleGroup: policy.ruleGroup
          },
          impersonatedProjectAuth: true,
          ...requestContext(flags),
          projectTenantId: projectKey
        }));
      } else {
        results.push(await blocksRequest<unknown>("/data/v4/data-access/policy/create", {
          body: {
            fieldNames: policy.fieldNames,
            isAllowPolicy: policy.isAllowPolicy,
            operation: policy.operation,
            policyDescription: policy.policyDescription,
            policyName,
            policyType: policy.policyType,
            priority: policy.priority,
            projectKey,
            ruleGroup: policy.ruleGroup,
            schemaId,
            schemaName
          },
          impersonatedProjectAuth: true,
          ...requestContext(flags),
          projectTenantId: projectKey
        }));
      }
    }
  }

  writeOutput(await withGatewayReload(flags, projectKey, { results }), flags);
}

/**
 * Resolves destination schema ids (for security entries and policies) and existing
 * policy ids by name, one lookup per unique schema.
 */
async function resolveDestinationContext(
  security: LocalSecurity[],
  policies: LocalPolicy[],
  flags: Record<string, string | boolean>,
  projectKey: string
): Promise<{ existingItemIdByKey: Map<string, string>; schemaIdByName: Map<string, string> }> {
  const policySchemaNames = new Set(policies.map((policy) => String(policy.schemaName ?? "")).filter(Boolean));
  const securitySchemaNames = security
    .map((item) => (typeof item.schemaName === "string" ? item.schemaName : ""))
    .filter(Boolean);
  const schemaNames = [...new Set([...policySchemaNames, ...securitySchemaNames])];
  const schemaIdByName = new Map<string, string>();
  const existingItemIdByKey = new Map<string, string>();

  for (const schemaName of schemaNames) {
    const schemaResponse = await blocksRequest<unknown>("/data/v4/schemas", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { PageNo: 1, PageSize: 5, ProjectKey: projectKey, SchemaName: schemaName }
    });
    const { items } = unwrapSchemaListResponse(schemaResponse);
    const match = items.find((item) => item.schemaName === schemaName);
    if (match && typeof match.id === "string") schemaIdByName.set(schemaName, match.id);
    if (!policySchemaNames.has(schemaName)) continue;

    const policyResponse = await blocksRequest<unknown>("/data/v4/data-access/policy/get", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey,
      query: { schemaName }
    });
    for (const item of unwrapDataArray(policyResponse, "data access policy")) {
      if (typeof item.policyName === "string" && typeof item.itemId === "string") {
        existingItemIdByKey.set(`${schemaName}::${item.policyName}`, item.itemId);
      }
    }
  }

  return { existingItemIdByKey, schemaIdByName };
}
