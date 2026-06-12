import { describe, expect, it } from 'vitest';
import { resolveHarnesses } from '../../../src/core/init/prompt-harness.js';
import { InvalidHarnessError } from '../../../src/core/skills/harness/adapter.js';

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

    expect(receivedChoices).toEqual([
      'claude-code',
      'opencode',
      'codex',
      'cursor',
      'github-copilot',
    ]);
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
