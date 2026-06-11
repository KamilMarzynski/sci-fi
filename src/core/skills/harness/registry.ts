import {
  type HarnessAdapter,
  type HarnessId,
  InvalidHarnessError,
  isHarnessId,
} from './adapter.js';

const registry = new Map<HarnessId, HarnessAdapter>();

export function registerAdapter(adapter: HarnessAdapter): void {
  registry.set(adapter.id, adapter);
}

export function getAdapter(id: string): HarnessAdapter {
  if (!isHarnessId(id)) {
    throw new InvalidHarnessError(id);
  }

  const adapter = registry.get(id);

  if (adapter === undefined) {
    throw new Error(`Harness "${id}" is known but has no registered adapter (internal error).`);
  }

  return adapter;
}
