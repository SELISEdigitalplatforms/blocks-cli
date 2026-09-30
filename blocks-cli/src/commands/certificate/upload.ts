import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { booleanFlag, stringFlag } from "../../lib/args.js";
import { blocksRequest } from "../../lib/api.js";
import { confirmMutation } from "../../lib/confirm.js";
import { CliActionableError } from "../../lib/errors.js";
import { buildCertificateForm, OS_CERTIFICATE_API, UploadCertificateResponse } from "../../lib/os-certificate.js";
import { upstreamOsMessage } from "../../lib/os-domain.js";
import { writeOutput } from "../../lib/output.js";
import { requestContext } from "../../lib/request-context.js";
import { parseCommand, selectedProject } from "../../lib/workspace.js";

/**
 * Uploads a public certificate (PEM/CRT) via multipart POST
 * /os/v4/Certificate/UploadCertificate. Query flags: isThirdParty, providerRef.
 */
export async function certificateUpload(argv: string[]): Promise<void> {
  const { flags } = parseCommand(argv);
  const filePath = stringFlag(flags, "file");
  if (!filePath) {
    throw new CliActionableError(
      "No file at ''.",
      "certificate_file_not_found",
      "Pass --file <path> to a PEM/CRT certificate on disk."
    );
  }

  // Single read closes the TOCTOU window CodeQL flags between access/stat and readFile.
  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch {
    throw new CliActionableError(
      `No file at '${filePath}'.`,
      "certificate_file_not_found",
      "Pass --file <path> to an existing PEM/CRT certificate."
    );
  }
  if (bytes.length === 0) {
    throw new CliActionableError(
      `'${filePath}' is empty.`,
      "certificate_file_empty",
      "Provide a non-empty certificate file."
    );
  }

  const isThirdParty = booleanFlag(flags, "third-party");
  const providerRefRaw = stringFlag(flags, "provider-ref").trim();
  const providerRef = providerRefRaw || undefined;
  const endpoint = `${OS_CERTIFICATE_API}/UploadCertificate`;

  if (booleanFlag(flags, "dry-run")) {
    writeOutput(
      {
        dryRun: true,
        endpoint,
        file: filePath,
        isThirdParty,
        providerRef: providerRef ?? null,
        query: {
          isThirdParty,
          ...(providerRef ? { providerRef } : {})
        }
      },
      flags
    );
    return;
  }

  await confirmMutation(
    flags,
    isThirdParty
      ? `Upload third-party certificate from '${filePath}'${providerRef ? ` (provider ${providerRef})` : ""}.`
      : `Upload tenant certificate from '${filePath}'.`
  );

  const form = buildCertificateForm(bytes, basename(filePath));
  const projectKey = await selectedProject(flags);
  const result = await blocksRequest<UploadCertificateResponse>(endpoint, {
    acceptFailureEnvelope: true,
    body: form,
    impersonatedProjectAuth: true,
    projectTenantId: projectKey,
    query: {
      isThirdParty,
      ...(providerRef ? { providerRef } : {})
    },
    ...requestContext(flags)
  });

  if (result?.isSuccess === false) {
    throw new CliActionableError(
      upstreamOsMessage(result, "Certificate upload failed."),
      "certificate_upload_failed",
      "Check the file and your mutate-token-validation-params permission, then retry."
    );
  }

  const output: Record<string, unknown> = {
    downloadUrl: result?.downloadUrl ?? "",
    isThirdParty,
    uploaded: true
  };
  if (providerRef) {
    output.providerRef = providerRef;
    if (!isThirdParty) {
      // blocks-os ignores ProviderRef when IsThirdParty is false (tenant has one own slot).
      output.providerRefIgnoredWhenNotThirdParty = true;
    }
  }

  writeOutput(output, flags);
}
