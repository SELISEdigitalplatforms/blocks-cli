/**
 * blocks-os CertificateController.UploadCertificate — multipart file + query flags.
 * Form field name must be `certificate` (IFormFile parameter). Query: isThirdParty,
 * optional providerRef. No list/get/delete HTTP actions exist today.
 */
export const OS_CERTIFICATE_API = "/os/v4/Certificate";

export type UploadCertificateResponse = {
  isSuccess?: boolean;
  message?: string | null;
  errors?: Record<string, string> | null;
  downloadUrl?: string;
} & Record<string, unknown>;

/** Builds the multipart body CertificateController binds as IFormFile? certificate. */
export function buildCertificateForm(bytes: Buffer, filename: string): FormData {
  const form = new FormData();
  // Same BlobPart cast as data/files/upload (Buffer → Blob under Node 20+).
  form.set("certificate", new Blob([bytes as BlobPart]), filename);
  return form;
}
