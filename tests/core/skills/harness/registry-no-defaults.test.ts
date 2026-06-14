import { describe, expect, it } from 'vitest';
import { getAdapter } from '../../../../src/core/skills/harness/registry.js';

// This file deliberately does NOT import register-defaults, so the registry is
// empty. It exercises the "known id but no registered adapter" guard, which is
// otherwise unreachable once the default adapters are registered.
describe('getAdapter without registered defaults', () => {
  it('throws an internal error for a known harness id that has no adapter', () => {
    expect(() => getAdapter('claude-code')).toThrowError(/known but has no registered adapter/);
  });
});
