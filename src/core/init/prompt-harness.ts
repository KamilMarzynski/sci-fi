import {
  InvalidHarnessError,
  KNOWN_HARNESS_IDS,
  isHarnessId,
  type HarnessId,
} from "../skills/harness/adapter.js";

export type HarnessAsk = (choices: readonly HarnessId[]) => Promise<string>;

export interface ResolveHarnessOptions {
  readonly flag: string | undefined;
  readonly yes: boolean;
  readonly ask: HarnessAsk;
}

const DEFAULT_HARNESS: HarnessId = "claude-code";

export async function resolveHarness(
  options: ResolveHarnessOptions,
): Promise<HarnessId> {
  if (options.flag !== undefined) {
    return validate(options.flag);
  }

  if (options.yes) {
    return DEFAULT_HARNESS;
  }

  const picked = await options.ask(KNOWN_HARNESS_IDS);
  return validate(picked);
}

function validate(value: string): HarnessId {
  if (!isHarnessId(value)) {
    throw new InvalidHarnessError(value);
  }

  return value;
}
