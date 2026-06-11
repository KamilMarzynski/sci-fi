import type { SkillBundle } from '../types.js';

export type HarnessId = 'claude-code' | 'opencode' | 'codex' | 'cursor';

export const KNOWN_HARNESS_IDS: readonly HarnessId[] = [
  'claude-code',
  'opencode',
  'codex',
  'cursor',
];

export interface HarnessAdapter {
  readonly id: HarnessId;
  readonly skillsBaseDir: string;
  install(bundles: readonly SkillBundle[], projectRoot: string): Promise<void>;
}

export class InvalidHarnessError extends Error {
  constructor(value: string) {
    super(`Unknown harness "${value}". Expected one of: ${KNOWN_HARNESS_IDS.join(', ')}.`);
    this.name = 'InvalidHarnessError';
  }
}

export function isHarnessId(value: string): value is HarnessId {
  return (KNOWN_HARNESS_IDS as readonly string[]).includes(value);
}
