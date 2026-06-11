import { describe, expect, it } from 'vitest';
import { resolveHarness, resolveHarnesses } from '../../../src/core/init/prompt-harness.js';
import { InvalidHarnessError } from '../../../src/core/skills/harness/adapter.js';

describe('resolveHarness', () => {
  it('returns the validated flag value when provided', async () => {
    const harness = await resolveHarness({
      flag: 'claude-code',
      yes: false,
      ask: async () => {
        throw new Error('ask should not be called when a flag is provided');
      },
    });

    expect(harness).toBe('claude-code');
  });

  it('throws InvalidHarnessError on an unknown flag value', async () => {
    await expect(
      resolveHarness({
        flag: 'nope',
        yes: false,
        ask: async () => 'claude-code',
      }),
    ).rejects.toThrowError(InvalidHarnessError);
  });

  it('defaults to claude-code when --yes is set and no flag', async () => {
    const harness = await resolveHarness({
      flag: undefined,
      yes: true,
      ask: async () => {
        throw new Error('ask should not be called when --yes is set');
      },
    });

    expect(harness).toBe('claude-code');
  });

  it('calls ask with all known harness ids and returns the picked one', async () => {
    let received: readonly string[] | undefined;

    const harness = await resolveHarness({
      flag: undefined,
      yes: false,
      ask: async (choices) => {
        received = choices;
        return 'opencode';
      },
    });

    expect(received).toEqual(['claude-code', 'opencode', 'codex', 'cursor']);
    expect(harness).toBe('opencode');
  });

  it('throws InvalidHarnessError when ask returns an unknown id', async () => {
    await expect(
      resolveHarness({
        flag: undefined,
        yes: false,
        ask: async () => 'nope',
      }),
    ).rejects.toThrowError(InvalidHarnessError);
  });
});

describe('resolveHarnesses', () => {
  it('deduplicates flag values preserving first-seen order', async () => {
    const harnesses = await resolveHarnesses({
      flags: ['cursor', 'claude-code', 'cursor'],
      yes: false,
      ask: async () => {
        throw new Error('ask should not be called when flags are provided');
      },
    });

    expect(harnesses).toEqual(['cursor', 'claude-code']);
  });

  it('throws InvalidHarnessError when a flag value is unknown', async () => {
    await expect(
      resolveHarnesses({
        flags: ['claude-code', 'nope'],
        yes: false,
        ask: async () => {
          throw new Error('ask should not be called');
        },
      }),
    ).rejects.toThrowError(InvalidHarnessError);
  });

  it('returns [claude-code] when yes is true and no flags', async () => {
    const harnesses = await resolveHarnesses({
      flags: [],
      yes: true,
      ask: async () => {
        throw new Error('ask should not be called when --yes is set');
      },
    });

    expect(harnesses).toEqual(['claude-code']);
  });

  it('calls ask with all known harness ids and returns validated deduped result', async () => {
    let receivedChoices: readonly string[] | undefined;

    const harnesses = await resolveHarnesses({
      flags: [],
      yes: false,
      ask: async (choices) => {
        receivedChoices = choices;
        return ['opencode', 'cursor', 'opencode'];
      },
    });

    expect(receivedChoices).toEqual(['claude-code', 'opencode', 'codex', 'cursor']);
    expect(harnesses).toEqual(['opencode', 'cursor']);
  });

  it('throws when ask returns an empty selection', async () => {
    await expect(
      resolveHarnesses({
        flags: [],
        yes: false,
        ask: async () => [],
      }),
    ).rejects.toThrow('At least one harness must be selected.');
  });
});
