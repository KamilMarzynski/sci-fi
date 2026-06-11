import { describe, expect, it } from 'vitest';
import { InvalidHarnessError } from '../../../../src/core/skills/harness/adapter.js';
import { getAdapter } from '../../../../src/core/skills/harness/registry.js';
import '../../../../src/core/skills/harness/register-defaults.js';

describe('getAdapter', () => {
  it('throws InvalidHarnessError for an unknown harness id', () => {
    expect(() => getAdapter('nope' as never)).toThrowError(InvalidHarnessError);
  });

  it('throws InvalidHarnessError for agents-md (no longer a known id)', () => {
    expect(() => getAdapter('agents-md' as never)).toThrowError(InvalidHarnessError);
  });

  it('returns the claude-code adapter', () => {
    const adapter = getAdapter('claude-code');
    expect(adapter.id).toBe('claude-code');
  });

  it('returns the opencode adapter', () => {
    const adapter = getAdapter('opencode');
    expect(adapter.id).toBe('opencode');
  });

  it('returns the codex adapter', () => {
    const adapter = getAdapter('codex');
    expect(adapter.id).toBe('codex');
  });

  it('returns the cursor adapter', () => {
    const adapter = getAdapter('cursor');
    expect(adapter.id).toBe('cursor');
  });
});
