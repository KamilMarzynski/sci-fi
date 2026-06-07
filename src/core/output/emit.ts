import { stderr, stdout } from 'node:process';
import { toSpecflowError } from './errors.js';

interface OptionReader {
  opts(): Record<string, unknown>;
}

export function jsonMode(command: OptionReader): boolean {
  return command.opts().json === true;
}

function ensureTrailingNewline(text: string): string {
  return text.endsWith('\n') ? text : `${text}\n`;
}

export function emitSuccess<T>(
  data: T,
  json: boolean,
  humanLines: string | readonly string[],
): void {
  if (json) {
    stdout.write(`${JSON.stringify({ ok: true, data })}\n`);
    return;
  }

  const text = Array.isArray(humanLines) ? humanLines.join('\n') : (humanLines as string);
  stdout.write(ensureTrailingNewline(text));
}

export function emitList<T>(
  rows: readonly T[],
  json: boolean,
  humanLines: readonly string[],
): void {
  if (json) {
    for (const row of rows) {
      stdout.write(`${JSON.stringify(row)}\n`);
    }
    return;
  }

  for (const line of humanLines) {
    stdout.write(ensureTrailingNewline(line));
  }
}

export function emitError(error: unknown, json: boolean): void {
  const sf = toSpecflowError(error);

  if (json) {
    const payload = {
      ok: false,
      error: {
        code: sf.code,
        message: sf.message,
        ...(sf.hint !== undefined && { hint: sf.hint }),
        ...(sf.details !== undefined && { details: sf.details }),
      },
    };
    stderr.write(`${JSON.stringify(payload)}\n`);
  } else {
    stderr.write(`${sf.code}: ${sf.message}\n`);
    if (sf.hint !== undefined) {
      stderr.write(`Hint: ${sf.hint}\n`);
    }
  }

  process.exitCode = sf.exitCode;
}
