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

/**
 * Runs a request to a `[ProtectedEndPoint]` action and turns its 403 into the permission it
 * needs. The generic 401/403 hint is `blocks login`, which cannot help here: for an impersonated
 * call Genesis checks the signed-in account's roles in the ROOT tenant's Permissions, so the
 * account's role there needs `resource`. `statuses` lists the refusal codes: an action that checks
 * the permission itself may answer 401 instead.
 */
export async function withPermissionHint<T>(resource: string, request: Promise<T>, statuses: readonly number[] = [403]): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof Error && statuses.some((status) => error.message.startsWith(`Blocks API ${status}`))) {
      throw new CliActionableError(
        `This account's role does not have the '${resource}' permission.`,
        "permission_required",
        `Have an admin of your root project add '${resource}' to your role, then sign in again (blocks login) so the token carries it.`
      );
    }
    throw error;
  }
}
