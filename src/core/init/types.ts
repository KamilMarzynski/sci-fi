import type { HarnessId } from '../skills/harness/adapter.js';

export interface InitOptions {
  readonly projectRoot: string;
  readonly harness?: HarnessId;
}
