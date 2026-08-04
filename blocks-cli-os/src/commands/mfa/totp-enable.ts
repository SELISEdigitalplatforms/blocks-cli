import { booleanFlag, integerFlag, stringFlag } from "../../lib/args.js";
import { confirmMutation } from "../../lib/confirm.js";
import { writeOutput } from "../../lib/output.js";
import { promptText } from "../../lib/prompt.js";
import { parseCommand } from "../../lib/workspace.js";
import { mfaBackupCodesGenerate } from "./backup-codes/generate.js";
import { mfaMethodSet } from "./method-set.js";
import { mfaTotpSetup } from "./totp-setup.js";
import { mfaTotpVerifySetup } from "./totp-verify-setup.js";

/**
 * Composed TOTP enrollment: setup -> (scan QR, enter code) -> verify -> switch the active
 * method to TOTP -> generate backup codes. This is one real enrollment sitting, not four
 * independent tasks -- nobody enables TOTP setup and comes back next week to verify it.
 *
 * --mfa-type is still required, not defaulted: the numeric MFA-method value that means
 * "TOTP" for a given tenant isn't documented anywhere in this CLI (mfa:method:set/mfa:generate
 * take the same raw, tenant-defined integer), so it's not safe to guess one here.
 */
export async function mfaTotpEnable(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const mfaType = integerFlag(flags, "mfa-type", NaN);
  if (!Number.isInteger(mfaType)) {
    throw new Error(
      "Provide --mfa-type <n> -- the numeric MFA method value your tenant uses for TOTP (the same value 'mfa:method:set' expects)."
    );
  }

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        mfaType,
        steps: [
          "mfa:totp:setup",
          "(scan the QR/secret with your authenticator app, then enter the code)",
          "mfa:totp:verify-setup <code>",
          `mfa:method:set ${mfaType}`,
          "mfa:backup-codes:generate"
        ]
      },
      flags
    );
    return;
  }

  await confirmMutation(flags, "Enable TOTP: start enrollment, verify it, switch to it as the active method, and generate backup codes.");

  console.log("== mfa:totp:setup ==");
  await mfaTotpSetup([]);
  console.log("Scan the QR code / secret above with your authenticator app.");

  const code = stringFlag(flags, "code") || (await promptText("Enter the 6-digit code from your authenticator app: "));
  if (!code) throw new Error("A verification code is required to complete TOTP setup.");

  console.log("== mfa:totp:verify-setup ==");
  await mfaTotpVerifySetup([code]);

  console.log("== mfa:method:set ==");
  await mfaMethodSet([String(mfaType)]);

  console.log("== mfa:backup-codes:generate ==");
  await mfaBackupCodesGenerate(["--yes"]);
}
