import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, pathsFromWorkspace, readWorkspaceConfig, selectedProject } from "../../lib/workspace.js";
import { readFile } from "node:fs/promises";

export async function releaseDeploy(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const config = await readReleaseConfig();
  const repoId = stringFlag(flags, "repo-id", { defaultValue: stringValue(config.repoId) });
  if (!repoId) throw new Error("Missing --repo-id or blocks/release/deploy.json repoId.");

  const body = {
    ...config,
    repoId
  };

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/release/v4/api/Build/manual", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Trigger configured release build for repo '${repoId}'.`);
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<unknown>("/release/v4/api/Build/manual", {
    impersonatedProjectAuth: true,
    ...requestContext(flags),
    body,
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}

async function readReleaseConfig(): Promise<Record<string, unknown>> {
  const workspace = await readWorkspaceConfig();
  const { releaseConfig } = pathsFromWorkspace(workspace);
  try {
    return JSON.parse(await readFile(releaseConfig, "utf8")) as Record<string, unknown>;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
