import { booleanFlag, stringFlag } from "../../../lib/args.js";
import { confirmMutation } from "../../../lib/confirm.js";
import { CliActionableError } from "../../../lib/errors.js";
import { createFunction, FUNCTION_TEMPLATES, pickOne } from "../../../lib/logic-functions.js";
import { writeOutput } from "../../../lib/output.js";
import { parseCommand, selectedProject } from "../../../lib/workspace.js";

/** Create a Draft function seeded from a starter template (Minimal unless --template). */
export async function logicFunctionCreate(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const name = stringFlag(flags, "name").trim();
  if (name.length < 2 || name.length > 64) {
    throw new CliActionableError("Provide --name (2-64 characters).", "FUNCTION_VALIDATION");
  }
  const description = stringFlag(flags, "description");
  if (description.length > 200) {
    throw new CliActionableError("--description may be at most 200 characters.", "FUNCTION_VALIDATION");
  }
  const templateRaw = stringFlag(flags, "template");
  const body: Record<string, unknown> = { name };
  if (description) body.description = description;
  if (templateRaw) body.template = pickOne(templateRaw, FUNCTION_TEMPLATES, "template", "FUNCTION_VALIDATION");

  if (booleanFlag(flags, "dry-run")) {
    writeOutput({ dryRun: true, endpoint: "/logic/v4/Functions/Create", method: "POST", request: body }, flags);
    return;
  }

  await confirmMutation(flags, `Create function '${name}'.`);
  const projectKey = await selectedProject(flags);
  writeOutput(await createFunction({ projectKey, flags, body }), flags);
}
