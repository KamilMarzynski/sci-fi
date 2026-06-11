import {
  type HarnessId,
  InvalidHarnessError,
  isHarnessId,
  KNOWN_HARNESS_IDS,
} from '../skills/harness/adapter.js';

// Single-select ask — used by the existing resolveHarness (kept for init.ts compat until T6).
export type HarnessAsk = (choices: readonly HarnessId[]) => Promise<string>;

// Multi-select ask — used by resolveHarnesses.
export type HarnessMultiAsk = (choices: readonly HarnessId[]) => Promise<readonly string[]>;

export interface ResolveHarnessOptions {
  readonly flag: string | undefined;
  readonly yes: boolean;
  readonly ask: HarnessAsk;
}

export interface ResolveHarnessesOptions {
  readonly flags: readonly string[];
  readonly yes: boolean;
  readonly ask: HarnessMultiAsk;
}

const DEFAULT_HARNESS: HarnessId = 'claude-code';

// Legacy single-select resolver — kept intact for init.ts until T6 replaces it.
export async function resolveHarness(options: ResolveHarnessOptions): Promise<HarnessId> {
  if (options.flag !== undefined) {
    return validate(options.flag);
  }

  if (options.yes) {
    return DEFAULT_HARNESS;
  }

  const picked = await options.ask(KNOWN_HARNESS_IDS);
  return validate(picked);
}

// Multi-select resolver — precedence: non-empty flags > yes > ask.
export async function resolveHarnesses(
  options: ResolveHarnessesOptions,
): Promise<readonly HarnessId[]> {
  if (options.flags.length > 0) {
    return validateAndDedup(options.flags);
  }

  if (options.yes) {
    return [DEFAULT_HARNESS];
  }

  const picked = await options.ask(KNOWN_HARNESS_IDS);
  if (picked.length === 0) {
    throw new Error('At least one harness must be selected.');
  }
  return validateAndDedup(picked);
}

function validate(value: string): HarnessId {
  if (!isHarnessId(value)) {
    throw new InvalidHarnessError(value);
  }

  return value;
}

function validateAndDedup(values: readonly string[]): readonly HarnessId[] {
  const seen = new Set<string>();
  const result: HarnessId[] = [];
  for (const v of values) {
    if (!isHarnessId(v)) {
      throw new InvalidHarnessError(v);
    }
    if (!seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result;
}
