import { readFile } from "node:fs/promises";
import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { compact } from "../../lib/json-flag.js";
import { writeOutput } from "../../lib/output.js";
import { redactSecrets } from "../../lib/redact.js";
import { requestContext } from "../../lib/request-context.js";
import { OS_SECRETS_API, SECRET_TYPE } from "../../lib/secrets.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Creates one secret per KEY=value line of a dotenv file (Secrets/set-many). Each key
 * becomes the secret's name; the response maps every name to its new secretId. This
 * always CREATES -- re-running it makes duplicates, because secret names are not unique.
 */
export async function secretsSetMany(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const file = stringFlag(flags, "env-file", { required: true });
  const description = stringFlag(flags, "description") || undefined;
  const organizationId = stringFlag(flags, "organization-id") || undefined;

  let content: string;
  try {
    content = await readFile(file, "utf8");
  } catch (error) {
    throw new CliActionableError(
      `Could not read '${file}': ${(error as Error).message}`,
      "secrets_file_unreadable",
      "Pass --env-file <path> pointing at a dotenv-format file (KEY=value per line)."
    );
  }
  const values = parseDotenv(content);
  const names = Object.keys(values);
  if (names.length === 0) {
    throw new CliActionableError(
      `'${file}' contains no KEY=value lines.`,
      "secrets_file_empty",
      "Check the file path and its dotenv format (KEY=value per line, # for comments)."
    );
  }

  const requests = names.map((name) => compact({ description, name, organizationId, type: SECRET_TYPE, value: values[name] }));

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      { count: requests.length, dryRun: true, endpoint: `${OS_SECRETS_API}/set-many`, names, request: redactSecrets(requests, ["value"]) },
      flags
    );
    return;
  }

  await confirmMutation(flags, `Create ${requests.length} secret(s) from '${file}': ${names.join(", ")} (values are never displayed).`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>(`${OS_SECRETS_API}/set-many`, {
    body: requests,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    ...requestContext(flags)
  });
  writeOutput(result, flags);
}

/**
 * Minimal dotenv parser: comments, blank lines, an optional `export ` prefix, and
 * single/double-quoted values. Local to this family on purpose.
 */
function parseDotenv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice("export ".length).trimStart() : line;
    const eq = withoutExport.indexOf("=");
    if (eq <= 0) continue;
    const key = withoutExport.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key)) continue;
    let value = withoutExport.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    } else {
      const hash = value.indexOf(" #");
      if (hash >= 0) value = value.slice(0, hash).trimEnd();
    }
    values[key] = value;
  }
  return values;
}
