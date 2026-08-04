import { randomUUID } from "node:crypto";
import { booleanFlag, integerFlag, stringFlag } from "../../../lib/args.js";
import { blocksRequest } from "../../../lib/api.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { writeOutput } from "../../../lib/output.js";
import { requestContext } from "../../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";
import { localizationKeyGenerateUilmFile } from "./generate-uilm-file.js";
import { localizationKeyTranslateAll } from "./translate-all.js";
import { localizationKeyUilmExport } from "./uilm-export.js";

const DEFAULT_POLL_INTERVAL_SECONDS = 10;
const DEFAULT_WAIT_TIMEOUT_SECONDS = 600;
const TERMINAL_TEXT_PATTERN = /complet|success|fail|error|done/i;

/**
 * Composed "translate this module and give me the export" flow: translate-all -> (optionally
 * wait for translation to finish, since it's processed async) -> generate-uilm-file ->
 * uilm-export. Without --wait, this just fires all 3 steps back to back (matching how a user
 * would run them by hand today) -- pass --wait to actually poll for completion in between.
 */
export async function localizationKeyTranslateAndExport(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const moduleId = stringFlag(flags, "module-id", { required: true });
  const dryRun = booleanFlag(flags, "dry-run");
  const wait = booleanFlag(flags, "wait");
  const correlationId = stringFlag(flags, "message-co-relation-id") || randomUUID();

  if (dryRun) {
    writeOutput(
      {
        dryRun: true,
        messageCoRelationId: correlationId,
        moduleId,
        steps: [
          "localization:key:translate-all",
          ...(wait ? ["(wait for translation to finish via GetTimelineByOperationId)"] : []),
          "localization:key:generate-uilm-file",
          "localization:key:uilm-export"
        ]
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    `Translate all untranslated keys in module '${moduleId}'${wait ? ", wait for completion," : ""} then generate and export the UILM file.`
  );

  console.log("== localization:key:translate-all ==");
  await localizationKeyTranslateAll([
    "--module-id",
    moduleId,
    ...(stringFlag(flags, "default-language") ? ["--default-language", stringFlag(flags, "default-language")] : []),
    "--message-co-relation-id",
    correlationId,
    "--yes"
  ]);

  if (wait) {
    await waitForTranslation(correlationId, flags);
  }

  const guid = stringFlag(flags, "guid");
  console.log("== localization:key:generate-uilm-file ==");
  await localizationKeyGenerateUilmFile(["--module-id", moduleId, ...(guid ? ["--guid", guid] : []), "--yes"]);

  console.log("== localization:key:uilm-export ==");
  await localizationKeyUilmExport([...passThroughUilmExportFlags(flags), "--yes"]);
}

function passThroughUilmExportFlags(flags: Record<string, string | boolean>): string[] {
  const args: string[] = [];
  for (const name of ["output-type", "app-ids", "languages", "reference-file-id", "caller-tenant-id", "start-date", "end-date"]) {
    const value = stringFlag(flags, name);
    if (value) args.push(`--${name}`, value);
  }
  return args;
}

async function waitForTranslation(operationId: string, flags: Record<string, string | boolean>): Promise<void> {
  const pollIntervalMs = integerFlag(flags, "poll-interval", DEFAULT_POLL_INTERVAL_SECONDS) * 1000;
  const timeoutMs = integerFlag(flags, "timeout", DEFAULT_WAIT_TIMEOUT_SECONDS) * 1000;
  const deadline = Date.now() + timeoutMs;
  const projectTenantId = await selectedProject(flags);

  console.log(`Waiting for translation operation '${operationId}' (polling every ${pollIntervalMs / 1000}s, timeout ${timeoutMs / 1000}s)...`);

  let previousCount = -1;
  let stableRounds = 0;

  while (true) {
    const result = await blocksRequest<unknown>("/localization/v4/Key/GetTimelineByOperationId", {
      impersonatedProjectAuth: true,
      ...requestContext(flags),
      projectTenantId,
      query: { OperationId: operationId, PageNumber: 1, PageSize: 50 }
    });

    console.log(JSON.stringify(result, null, 2));
    const entries = normalizeList(result);

    if (containsTerminalText(result)) return;

    if (entries.length > 0) {
      if (entries.length === previousCount) {
        stableRounds++;
        // Timeline entry count unchanged across 2 consecutive polls -- treat as settled,
        // since there's no documented explicit "done" field to check against.
        if (stableRounds >= 2) return;
      } else {
        stableRounds = 0;
      }
      previousCount = entries.length;
    }

    if (Date.now() >= deadline) {
      throw new CliActionableError(
        `Timed out after ${timeoutMs / 1000}s waiting for translation operation '${operationId}' to settle.`,
        "translation_wait_timeout",
        `Check manually with 'blocks-os localization:key:get-timeline-by-operation-id ${operationId}', then run generate-uilm-file/uilm-export yourself once ready.`
      );
    }

    await delay(pollIntervalMs);
  }
}

function normalizeList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    for (const key of ["data", "items", "results", "timeline"]) {
      const value = (raw as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function containsTerminalText(value: unknown, depth = 0): boolean {
  if (depth > 3 || value === null || value === undefined) return false;
  if (typeof value === "string") return TERMINAL_TEXT_PATTERN.test(value);
  if (Array.isArray(value)) return value.some((item) => containsTerminalText(item, depth + 1));
  if (typeof value === "object") return Object.values(value).some((item) => containsTerminalText(item, depth + 1));
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
