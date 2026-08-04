import { booleanFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { readRulesFile } from "../../../lib/data-files.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

type RulesDocument = {
  policies?: unknown;
  security?: unknown;
};

export async function dataRulesDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const projectKey = await selectedProject(flags);
  const dryRun = booleanFlag(flags, "dry-run");
  const rules: RulesDocument = await readRulesFile().catch((error: NodeJS.ErrnoException) => {
    if (dryRun && error.code === "ENOENT") return {};
    throw error;
  });
  const security = Array.isArray(rules.security) ? rules.security : [];
  const policies = Array.isArray(rules.policies) ? rules.policies : [];

  if (dryRun) {
    writeOutput({ dryRun: true, policies: policies.length, security: security.length }, flags);
    return;
  }

  await confirmMutation(flags, `Deploy data rules to project '${projectKey}'.`);
  const results: unknown[] = [];

  for (const item of security) {
    results.push(await blocksRequest<unknown>("/data/v4/data-access/security/change", {
      body: { ...(item as object), projectKey },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }));
  }

  for (const item of policies) {
    const policy = item as Record<string, unknown>;
    const path = policy.itemId ? "/data/v4/data-access/policy/update" : "/data/v4/data-access/policy/create";
    results.push(await blocksRequest<unknown>(path, {
      body: { ...policy, projectKey },
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId: projectKey
    }));
  }

  writeOutput({ results }, flags);
}
