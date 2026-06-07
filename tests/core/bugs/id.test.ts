import { describe, expect, it } from 'vitest';
import { formatBugId } from '../../../src/core/bugs/id.js';

describe('formatBugId', () => {
  it('pads single digits to four places', () => {
    expect(formatBugId(1)).toBe('BUG-0001');
  });

  it('pads two digit numbers', () => {
    expect(formatBugId(42)).toBe('BUG-0042');
  });

  it('does not truncate large numbers', () => {
    expect(formatBugId(10000)).toBe('BUG-10000');
  });
});
