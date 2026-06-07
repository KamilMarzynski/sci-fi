export type ErrorCode =
  | "INVALID_ARGUMENT"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PRECONDITION_FAILED"
  | "INTERNAL";

const EXIT_CODES: Record<ErrorCode, number> = {
  INVALID_ARGUMENT: 2,
  NOT_FOUND: 3,
  PRECONDITION_FAILED: 4,
  CONFLICT: 5,
  INTERNAL: 1,
};

export interface SpecflowErrorOptions {
  hint?: string;
  details?: unknown;
  cause?: unknown;
}

export class SpecflowError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, options: SpecflowErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "SpecflowError";
    this.code = code;
    if (options.hint !== undefined) {
      this.hint = options.hint;
    }
    if (options.details !== undefined) {
      this.details = options.details;
    }
  }

  get exitCode(): number {
    return EXIT_CODES[this.code];
  }
}

export function toSpecflowError(error: unknown): SpecflowError {
  if (error instanceof SpecflowError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : "specflow failed with an unexpected error.";

  return new SpecflowError("INTERNAL", message, { cause: error });
}
