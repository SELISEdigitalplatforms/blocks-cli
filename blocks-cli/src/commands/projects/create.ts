import { randomBytes } from "node:crypto";
import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { withAccountMode } from "../../lib/auth.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { isRecord } from "../../lib/data-response.js";
import { writeOutput } from "../../lib/output.js";
import { listProjectGroups, type ProjectRecord } from "../../lib/project-info.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand } from "../../lib/workspace.js";

const CREATE_ENDPOINT = "/os/v4/Project/Create";
// This command creates exactly one application, always in 'dev'. More
// environments are added later from the portal (or by a future command that
// passes tenantGroupId); nothing here may widen that.
const ENVIRONMENT = "dev";
// Project/Gets builds each tenantId as the environment letter prefixed onto
// the tenant group id -- 'd' for dev, uppercased.
const ENVIRONMENT_LETTER = "d";
const ENVIRONMENT_TENANT_PREFIX = ENVIRONMENT_LETTER.toUpperCase();
// Only ever a placeholder: the server validates that the domain parses as an
// absolute http(s) URL and then discards it, assigning its own domain during
// provisioning (environment letter + tenant slug, e.g.
// https://dboafe.slsblx.com). Mirror that shape so a dry-run payload looks
// like what the platform actually hands back.
const PLACEHOLDER_BASE_DOMAIN = "slsblx.com";
const PLACEHOLDER_COOKIE_DOMAIN = "slsblx.com";
const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 100;
const VERIFY_ATTEMPTS = 5;
const VERIFY_INTERVAL_MS = 2000;

type CreateProjectResponse = {
  errors?: Record<string, string> | null;
  isSuccess?: boolean;
  tenantGroupId?: string;
};

export async function createProject(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const name = (args[0] || stringFlag(flags, "name")).trim();

  if (!name) {
    throw new CliActionableError(
      "Missing project name.",
      "missing_project_name",
      'blocks projects create "<name>"'
    );
  }

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    throw new CliActionableError(
      `Project name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters.`,
      "invalid_project_name",
      `blocks projects create "<${NAME_MIN_LENGTH}-${NAME_MAX_LENGTH} character name>"`
    );
  }

  const body = {
    name,
    isAcceptBlocksTerms: true,
    isUseBlocksExclusively: true,
    isProduction: false,
    resources: [],
    applicationContexts: [
      {
        cookieDomain: PLACEHOLDER_COOKIE_DOMAIN,
        domain: placeholderDomain(),
        environment: ENVIRONMENT
      }
    ]
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: CREATE_ENDPOINT, request: body }, flags);
    return;
  }

  await confirmMutation(
    flags,
    `Create Blocks project '${name}' with a single '${ENVIRONMENT}' environment. This accepts the Blocks terms (isAcceptBlocksTerms, isUseBlocksExclusively) on your behalf.`
  );

  // No tenantGroupId in the body: omitting it is what makes this a new
  // project. Sending one would instead add an environment to an existing
  // project, which this command deliberately cannot do.
  const transition = await withAccountMode(stringFlag(flags, "account") || undefined, async () => {
    if (!booleanFlag(flags, "allow-duplicate-name")) await assertNameIsFree(name, flags);

    const result = await blocksRequest<CreateProjectResponse>(CREATE_ENDPOINT, {
      acceptFailureEnvelope: true,
      accountAuth: true,
      ...requestContext(flags),
      body
    });

    if (!result?.isSuccess || !result.tenantGroupId) {
      throw new CliActionableError(
        `Project/Create rejected '${name}': ${formatErrors(result?.errors)}`,
        "project_create_failed",
        "blocks projects list --json"
      );
    }

    const tenantGroupId = result.tenantGroupId;
    const created = await findCreatedProject(tenantGroupId, flags);
    return { created, tenantGroupId };
  });
  const { created, tenantGroupId } = transition.result;
  const tenantId = created?.tenantId ?? `${ENVIRONMENT_TENANT_PREFIX}${tenantGroupId}`;

  writeOutput(
    {
      domain: created?.applications?.[0]?.domain ?? "",
      environment: created?.environment ?? ENVIRONMENT,
      name: created?.name ?? name,
      tenantGroupId,
      tenantId,
      verified: Boolean(created)
    },
    flags
  );

  if (!flags.json) {
    if (!created) {
      console.log(`Project/Gets has not listed '${tenantId}' yet. Re-run 'blocks projects list' to confirm before using it.`);
    }
    console.log(`Next: blocks use ${tenantId}`);
  }
  if (transition.restoreError) {
    console.warn(`Warning: project '${name}' was created, but project session '${transition.previousProject}' could not be restored: ${transition.restoreError.message}`);
  }
}

async function assertNameIsFree(name: string, flags: Record<string, string | boolean>): Promise<void> {
  const groups = await listProjectGroups(flags, { accountOnly: true });
  const target = name.toLowerCase();
  const clash = groups.some(
    (group) =>
      (group.name ?? "").trim().toLowerCase() === target ||
      (group.projects ?? []).some((project) => (project.name ?? "").trim().toLowerCase() === target)
  );

  if (!clash) return;

  // A retried create makes a second tenant group with the same name rather
  // than failing, so an accidental duplicate is only preventable here.
  throw new CliActionableError(
    `A project named '${name}' already exists on this account.`,
    "project_name_taken",
    "blocks projects list --json, or re-run with --allow-duplicate-name to create a second project with this name"
  );
}

// Provisioning is asynchronous (Project/Create hands the tenant to a
// consumer queue) but fast, so poll Project/Gets briefly instead of
// reporting a tenantId the platform has not published yet.
async function findCreatedProject(
  tenantGroupId: string,
  flags: Record<string, string | boolean>
): Promise<ProjectRecord | undefined> {
  const expectedTenantId = `${ENVIRONMENT_TENANT_PREFIX}${tenantGroupId}`;

  for (let attempt = 0; attempt < VERIFY_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await delay(VERIFY_INTERVAL_MS);

    const groups = await listProjectGroups(flags, { accountOnly: true }).catch(() => []);
    const group = groups.find((item) => item.tenantGroupId === tenantGroupId);
    const project = (group?.projects ?? []).find(
      (item) => item.tenantId === expectedTenantId || item.environment === ENVIRONMENT
    );
    if (project) return project;
  }

  return undefined;
}

function placeholderDomain(): string {
  return `https://${ENVIRONMENT_LETTER}${randomSlug(5)}.${PLACEHOLDER_BASE_DOMAIN}`;
}

function randomSlug(length: number): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return Array.from(randomBytes(length), (byte) => letters[byte % letters.length]).join("");
}

function formatErrors(errors: Record<string, string> | null | undefined): string {
  if (!isRecord(errors)) return "no error detail returned.";

  const entries = Object.entries(errors).map(([key, value]) => `${key}: ${String(value)}`);
  return entries.length > 0 ? entries.join("; ") : "no error detail returned.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
