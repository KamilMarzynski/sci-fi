import { describe, expect, it } from 'vitest';
import { ScifiError, toScifiError } from '../../../src/core/output/errors.js';

describe('ScifiError', () => {
  it('maps CANCELLED to exit code 130', () => {
    const error = new ScifiError('CANCELLED', 'user cancelled');
    expect(error.exitCode).toBe(130);
  });
});

describe('toScifiError', () => {
  it('preserves an existing CANCELLED ScifiError unchanged', () => {
    const original = new ScifiError('CANCELLED', 'user cancelled');
    const result = toScifiError(original);
    expect(result).toBe(original);
    expect(result.code).toBe('CANCELLED');
  });
});
