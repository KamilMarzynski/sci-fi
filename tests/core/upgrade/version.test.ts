import { execFile } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCurrentVersion, readNewVersion } from '../../../src/core/upgrade/version.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

const mockExecFile = vi.mocked(execFile);

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

describe('readCurrentVersion', () => {
  it('returns version string from a valid package root', async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'scifi-ver-'));
    temporaryDirectories.push(packageRoot);
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'scifi', version: '1.2.3' }),
      'utf8',
    );

    expect(readCurrentVersion(packageRoot)).toBe('1.2.3');
  });
});

describe('readNewVersion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns <binPath> --version and parses plain version from stdout', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(null, '1.1.0\n', '');
      return {} as ReturnType<typeof execFile>;
    });

    const version = await readNewVersion('/usr/local/bin/scifi');

    expect(version).toBe('1.1.0');
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/local/bin/scifi',
      ['--version'],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
  });

  it('parses version when stdout includes program name prefix (e.g. "scifi 1.1.0")', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(null, 'scifi 1.1.0\n', '');
      return {} as ReturnType<typeof execFile>;
    });

    const version = await readNewVersion('/usr/local/bin/scifi');

    expect(version).toBe('1.1.0');
  });

  it('parses version when stdout has leading "v" (e.g. "v1.1.0")', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(null, 'v1.1.0\n', '');
      return {} as ReturnType<typeof execFile>;
    });

    const version = await readNewVersion('/usr/local/bin/scifi');

    expect(version).toBe('1.1.0');
  });

  it('throws ScifiError when spawn fails (binary missing)', async () => {
    const errnoError = Object.assign(new Error('spawn scifi ENOENT'), {
      code: 'ENOENT',
    });

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: Error, stdout: string, stderr: string) => void)(errnoError, '', '');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(readNewVersion('/nonexistent/scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('Failed to run') as unknown,
    });
  });

  it('throws ScifiError when spawn fails with non-zero exit', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (
        callback as (err: { message: string; code: number }, stdout: string, stderr: string) => void
      )({ message: 'Command failed', code: 1 }, '', 'some error');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(readNewVersion('/usr/local/bin/scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('Failed to run') as unknown,
    });
  });

  it('throws ScifiError when stdout cannot be parsed as a version', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        'some garbage output\n',
        '',
      );
      return {} as ReturnType<typeof execFile>;
    });

    await expect(readNewVersion('/usr/local/bin/scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('Could not parse version') as unknown,
    });
  });
});
