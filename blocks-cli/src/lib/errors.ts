export class CliActionableError extends Error {
  readonly code: string;
  readonly nextStep?: string;
  /** Optional structured field errors (e.g. PROXY_VALIDATION). */
  readonly errors?: unknown;

  constructor(message: string, code: string, nextStep?: string, errors?: unknown) {
    super(message);
    this.name = "CliActionableError";
    this.code = code;
    this.nextStep = nextStep;
    if (errors !== undefined) this.errors = errors;
  }
}
