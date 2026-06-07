import {
  type HarnessAdapter,
  type HarnessId,
  HarnessNotImplementedError,
  InvalidHarnessError,
  isHarnessId,
} from './adapter.js';

type RegistryEntry = HarnessAdapter | 'not-implemented';

const registry: Record<HarnessId, RegistryEntry> = {
  'claude-code': 'not-implemented',
  opencode: 'not-implemented',
  codex: 'not-implemented',
  cursor: 'not-implemented',
  'agents-md': 'not-implemented',
};

export function registerAdapter(adapter: HarnessAdapter): void {
  registry[adapter.id] = adapter;
}

export function getAdapter(id: string): HarnessAdapter {
  if (!isHarnessId(id)) {
    throw new InvalidHarnessError(id);
  }

  const entry = registry[id];

  if (entry === 'not-implemented') {
    throw new HarnessNotImplementedError(id);
  }

  return entry;
}
