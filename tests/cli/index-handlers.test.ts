import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CommanderError } from 'commander';
import { afterEach, describe, expect, it } from 'vitest';
import { handleCliError, runCli } from '../../src/cli/index.js';
import { ScifiError } from '../../src/core/output/errors.js';

interface Captured {
  stdout: string;
  stderr: string;
  exitCode: number;
}

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

async function capture(run: () => Promise<void> | void): Promise<Captured> {
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
    await run();
  } finally {
    process.stdout.write = originalOut;
    process.stderr.write = originalErr;
  }

  const exitCode = typeof process.exitCode === 'number' ? process.exitCode : 0;
  process.exitCode = originalExitCode;
  return { stdout: out.join(''), stderr: err.join(''), exitCode };
}

describe('handleCliError', () => {
  it('treats a CommanderError with exit code 0 (help/version) as a clean exit', async () => {
    const result = await capture(() => {
      handleCliError(new CommanderError(0, 'commander.helpDisplayed', '(outputHelp)'), [
        'node',
        'scifi',
      ]);
    });

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('maps a non-zero CommanderError to a structured INVALID_ARGUMENT error', async () => {
    const result = await capture(() => {
      handleCliError(
        new CommanderError(
          1,
          'commander.missingArgument',
          "error: missing required argument 'slug'",
        ),
        ['node', 'scifi', 'spec'],
      );
    });

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INVALID_ARGUMENT');
    expect(result.stderr).toContain("missing required argument 'slug'");
    expect(result.stderr).not.toContain('error: error:');
  });

  it('emits a structured INVALID_ARGUMENT error as JSON when --json is present', async () => {
    const result = await capture(() => {
      handleCliError(new CommanderError(1, 'commander.unknownOption', 'error: unknown option'), [
        'node',
        'scifi',
        '--json',
      ]);
    });

    const payload = JSON.parse(result.stderr);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('INVALID_ARGUMENT');
  });

  it('passes through non-Commander errors to emitError', async () => {
    const result = await capture(() => {
      handleCliError(new ScifiError('NOT_FOUND', 'nope'), ['node', 'scifi']);
    });

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND: nope');
  });
});

describe('runCli', () => {
  it('runs a command to completion on the happy path', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-run-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const result = await capture(() => runCli(['node', 'scifi', 'spec', 'demo-feature']));

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('demo-feature');
  });

  it('catches usage errors thrown by the parser and reports them', async () => {
    const result = await capture(() => runCli(['node', 'scifi', 'spec']));

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain('INVALID_ARGUMENT');
  });

  it('catches runtime errors and reports them', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-run-cli-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const result = await capture(() => runCli(['node', 'scifi', 'status', 'missing-feature']));

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain('NOT_FOUND');
  });
});
