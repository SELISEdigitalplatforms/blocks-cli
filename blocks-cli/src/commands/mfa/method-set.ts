import { optionalIntegerFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

export async function mfaMethodSet(argv: string[]): Promise<void> {
  const { args, flags } = parseCommand(argv);
  // optionalIntegerFlag, not `integerFlag(...) || Number(args[0])`: mfaType 0 (None) is a
  // valid enum value, and `0 || ...` silently fell through to the missing positional.
  const mfaType = optionalIntegerFlag(flags, "mfa-type") ?? Number(args[0]);
  if (!Number.isInteger(mfaType)) {
    throw new Error(
      "Provide --mfa-type <n> (or a positional integer). IAM's UserMfaType: 0 None, 1 TOTP, 2 Email, 3 Sms, 4 WhatsApp."
    );
  }
  // IAM's PUT /mfa/method only branches on TOTP and Email; every other value falls
  // through to its disable path and turns the user's MFA off. Say so rather than
  // letting "switch to SMS" silently unenroll them.
  if (mfaType !== 1 && mfaType !== 2) {
    console.warn(
      `Warning: IAM only switches to 1 (TOTP) or 2 (Email). --mfa-type ${mfaType} disables MFA for this user instead -- use 'blocks mfa disable' if that is what you meant.`
    );
  }
  const projectKey = await selectedProject(flags);

  const result = await blocksRequest<unknown>("/iam/v4/mfa/method", {
    body: { mfaType },
    impersonatedProjectAuth: true,
    method: "PUT",
    ...requestContext(flags),
    projectTenantId: projectKey
  });
  writeOutput(result, flags);
}
