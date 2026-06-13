import { ScifiError } from '../output/errors.js';
import {
  type HarnessId,
  InvalidHarnessError,
  isHarnessId,
  KNOWN_HARNESS_IDS,
} from '../skills/harness/adapter.js';

export type HarnessMultiAsk = (choices: readonly HarnessId[]) => Promise<readonly string[]>;

export interface ResolveHarnessesOptions {
  readonly flags: readonly string[];
  readonly yes: boolean;
  readonly ask: HarnessMultiAsk;
}

// Multi-select resolver — precedence: non-empty flags > yes > ask.
export async function resolveHarnesses(
  options: ResolveHarnessesOptions,
): Promise<readonly HarnessId[]> {
  if (options.flags.length > 0) {
    return validateAndDedup(options.flags);
  }

  if (options.yes) {
    throw new ScifiError(
      'INVALID_ARGUMENT',
      'At least one --harness flag is required when using --yes.',
      { hint: `Available harnesses: ${KNOWN_HARNESS_IDS.join(', ')}.` },
    );
  }

  const picked = await options.ask(KNOWN_HARNESS_IDS);
  if (picked.length === 0) {
    throw new Error('At least one harness must be selected.');
  }
  return validateAndDedup(picked);
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
