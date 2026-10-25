import { access, mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { CliActionableError } from "../../../lib/errors.js";
import { configOf, FUNCTION_DIR_FILES, getFunction, requireId } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/**
 * Write a function's working copy into a directory -- index.js, package.json,
 * package-lock.json (when it has one) and function.json (trigger, variables,
 * output actions, rate limit) -- the layout `logic function save --dir` reads back.
 * Local files only; existing files are kept unless --force.
 */
export async function logicFunctionExport(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  const usage = "blocks logic function export <function-id> --dir <path> [--force] [--json]";
  const functionId = requireId(args[0], "function id", "function_id_required", usage);
  const dir = stringFlag(flags, "dir");
  if (!dir) throw new CliActionableError("Provide --dir <path> to write the function into.", "function_dir_required", `Usage: ${usage}`);

  const projectKey = await selectedProject(flags);
  const detail = await getFunction({ projectKey, flags, functionId });

  const files: Array<[string, string]> = [
    [FUNCTION_DIR_FILES.index, String(detail.indexJs ?? "")],
    [FUNCTION_DIR_FILES.package, String(detail.packageJson ?? "")],
    [FUNCTION_DIR_FILES.config, `${JSON.stringify(configOf(detail), null, 2)}\n`]
  ];
  if (typeof detail.lockJson === "string" && detail.lockJson) files.push([FUNCTION_DIR_FILES.lock, detail.lockJson]);

  const force = booleanFlag(flags, "force");
  if (!force) {
    const existing: string[] = [];
    for (const [name] of files) {
      try {
        await access(join(dir, name));
        existing.push(name);
      } catch {
        // Not there yet: fine to write.
      }
    }
    if (existing.length > 0) {
      throw new CliActionableError(
        `${existing.join(", ")} already exist in ${dir}.`,
        "function_dir_not_empty",
        "Pass --force to overwrite them, or choose another --dir."
      );
    }
  }

  await mkdir(dir, { recursive: true });
  for (const [name, content] of files) await writeFile(join(dir, name), content);
  writeOutput({
    functionId,
    name: detail.name,
    dir: resolve(dir),
    files: files.map(([name]) => name),
    status: detail.status,
    isDirty: detail.isDirty,
    activeVersionNumber: detail.activeVersionNumber ?? null
  }, flags);
}
