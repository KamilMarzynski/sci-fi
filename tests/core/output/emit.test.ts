import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitError, emitList, emitSuccess, jsonMode } from '../../../src/core/output/emit.js';
import { ScifiError } from '../../../src/core/output/errors.js';

function captureStdout(): { lines: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    if (typeof chunk === 'string') chunks.push(chunk);
    return true;
  });
  return { lines: () => chunks.join(''), restore: () => spy.mockRestore() };
}

function captureStderr(): { lines: () => string; restore: () => void } {
  const chunks: string[] = [];
  const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk: string | Uint8Array) => {
    if (typeof chunk === 'string') chunks.push(chunk);
    return true;
  });
  return { lines: () => chunks.join(''), restore: () => spy.mockRestore() };
}

const originalExitCode = process.exitCode;

afterEach(() => {
  process.exitCode = originalExitCode;
  vi.restoreAllMocks();
});

describe('jsonMode', () => {
  it('reads the json flag from a command option reader', () => {
    expect(jsonMode({ opts: () => ({ json: true }) })).toBe(true);
    expect(jsonMode({ opts: () => ({ json: false }) })).toBe(false);
    expect(jsonMode({ opts: () => ({}) })).toBe(false);
  });
});

describe('emitSuccess', () => {
  it('writes a JSON envelope when json is true', () => {
    const out = captureStdout();
    emitSuccess({ ok: 1 }, true, 'ignored');
    out.restore();
    expect(JSON.parse(out.lines())).toEqual({ ok: true, data: { ok: 1 } });
  });

  it('joins array human lines and appends a trailing newline', () => {
    const out = captureStdout();
    emitSuccess({}, false, ['line one', 'line two']);
    out.restore();
    expect(out.lines()).toBe('line one\nline two\n');
  });

  it('preserves an existing trailing newline on a string payload', () => {
    const out = captureStdout();
    emitSuccess({}, false, 'already terminated\n');
    out.restore();
    expect(out.lines()).toBe('already terminated\n');
  });
});

describe('emitList', () => {
  it('writes one JSON row per entry when json is true', () => {
    const out = captureStdout();
    emitList([{ a: 1 }, { a: 2 }], true, ['ignored']);
    out.restore();
    expect(out.lines()).toBe('{"a":1}\n{"a":2}\n');
  });

  it('writes human lines with trailing newlines when json is false', () => {
    const out = captureStdout();
    emitList([{ a: 1 }], false, ['header', 'row']);
    out.restore();
    expect(out.lines()).toBe('header\nrow\n');
  });
});

describe('emitError', () => {
  it('writes a JSON error envelope with hint and details when json is true', () => {
    const err = captureStderr();
    emitError(
      new ScifiError('NOT_FOUND', 'gone', { hint: 'look elsewhere', details: { id: 7 } }),
      true,
    );
    err.restore();
    expect(JSON.parse(err.lines())).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'gone', hint: 'look elsewhere', details: { id: 7 } },
    });
    expect(process.exitCode).toBe(3);
  });

  it('writes a human error with a hint line when json is false', () => {
    const err = captureStderr();
    emitError(new ScifiError('PRECONDITION_FAILED', 'nope', { hint: 'do X first' }), false);
    err.restore();
    expect(err.lines()).toBe('PRECONDITION_FAILED: nope\nHint: do X first\n');
    expect(process.exitCode).toBe(4);
  });

  it('writes a human error without a hint line when no hint is present', () => {
    const err = captureStderr();
    emitError(new ScifiError('INTERNAL', 'boom'), false);
    err.restore();
    expect(err.lines()).toBe('INTERNAL: boom\n');
    expect(process.exitCode).toBe(1);
  });
});
