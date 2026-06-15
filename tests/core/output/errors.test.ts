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

  it('wraps a non-Error value as an INTERNAL error with the default message', () => {
    const result = toScifiError('boom');
    expect(result.code).toBe('INTERNAL');
    expect(result.message).toBe('scifi failed with an unexpected error.');
  });

  it('falls back to the default message when an Error has an empty message', () => {
    const result = toScifiError(new Error(''));
    expect(result.code).toBe('INTERNAL');
    expect(result.message).toBe('scifi failed with an unexpected error.');
  });

  it('preserves a non-empty Error message', () => {
    const result = toScifiError(new Error('disk full'));
    expect(result.code).toBe('INTERNAL');
    expect(result.message).toBe('disk full');
  });
});
