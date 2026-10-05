export class CliActionableError extends Error {
  readonly code: string;
  readonly nextStep?: string;
  /** Machine-readable extras printed beside `code` in --json mode (e.g. the files a merge conflicted on). */
  readonly details?: Record<string, unknown>;

  constructor(message: string, code: string, nextStep?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "CliActionableError";
    this.code = code;
    this.nextStep = nextStep;
    this.details = details;
  }
}
