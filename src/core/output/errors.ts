export type ErrorCode =
  | 'INVALID_ARGUMENT'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PRECONDITION_FAILED'
  | 'CANCELLED'
  | 'INTERNAL';

const EXIT_CODES: Record<ErrorCode, number> = {
  INVALID_ARGUMENT: 2,
  NOT_FOUND: 3,
  PRECONDITION_FAILED: 4,
  CONFLICT: 5,
  CANCELLED: 130,
  INTERNAL: 1,
};

export interface ScifiErrorOptions {
  hint?: string;
  details?: unknown;
  cause?: unknown;
}

export class ScifiError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, options: ScifiErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = 'ScifiError';
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

export function toScifiError(error: unknown): ScifiError {
  if (error instanceof ScifiError) {
    return error;
  }

  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : 'scifi failed with an unexpected error.';

  return new ScifiError('INTERNAL', message, { cause: error });
}
