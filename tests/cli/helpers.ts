import { buildProgram } from '../../src/cli/index.js';

export interface CliRun {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Runs the CLI in-process, capturing stdout/stderr and the resulting
 * process.exitCode. Commands emit structured errors to stderr and set an exit
 * code rather than throwing, so callers assert on the returned run instead of
 * a rejected promise. The ambient process.exitCode is restored afterwards.
 */
export async function runCli(args: readonly string[]): Promise<CliRun> {
  const out: string[] = [];
  const err: string[] = [];
  const originalOut = process.stdout.write.bind(process.stdout);
  const originalErr = process.stderr.write.bind(process.stderr);
  const originalExitCode = process.exitCode;

  process.exitCode = 0;
  process.stdout.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') out.push(chunk);
    return true;
  };
  process.stderr.write = (chunk: string | Uint8Array): boolean => {
    if (typeof chunk === 'string') err.push(chunk);
    return true;
  };

  try {
    await buildProgram().parseAsync(['node', 'specflow', ...args]);
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }

  const exitCode = typeof process.exitCode === 'number' ? process.exitCode : 0;
  process.exitCode = originalExitCode;

  return { stdout: out.join(''), stderr: err.join(''), exitCode };
}
