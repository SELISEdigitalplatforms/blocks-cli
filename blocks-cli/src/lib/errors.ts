export class CliActionableError extends Error {
  readonly code: string;
  readonly nextStep?: string;

  constructor(message: string, code: string, nextStep?: string) {
    super(message);
    this.name = "CliActionableError";
    this.code = code;
    this.nextStep = nextStep;
  }
}
