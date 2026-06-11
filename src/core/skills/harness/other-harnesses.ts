import { join } from 'node:path';
import type { HarnessAdapter, HarnessId } from './adapter.js';
import { createSkillBundleAdapter } from './skill-writer.js';

interface HarnessSpec {
  readonly id: HarnessId;
  readonly baseDir: string;
}

const HARNESS_SPECS: readonly HarnessSpec[] = [
  { id: 'opencode', baseDir: join('.opencode', 'skills') },
  { id: 'codex', baseDir: join('.codex', 'skills') },
  { id: 'cursor', baseDir: join('.cursor', 'skills') },
];

export const otherAdapters: readonly HarnessAdapter[] = HARNESS_SPECS.map((spec) =>
  createSkillBundleAdapter(spec),
);
