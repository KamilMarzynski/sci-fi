import {
  type HarnessId,
  InvalidHarnessError,
  isHarnessId,
  KNOWN_HARNESS_IDS,
} from '../skills/harness/adapter.js';

// Single-select ask — transitional; used by resolveHarness for init.ts compat. Removed in T6.
export type HarnessAsk = (choices: readonly HarnessId[]) => Promise<string>;

// Multi-select ask — used by resolveHarnesses. This is the type design.md refers to as
// `HarnessAsk`; it was given a distinct name to coexist with the legacy single-select
// HarnessAsk during the transition. T6 reconciles this by removing the legacy
// resolveHarness/HarnessAsk once init.ts moves to multi-select.
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

// Transitional single-select resolver — kept intact for init.ts until T6 removes it.
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
