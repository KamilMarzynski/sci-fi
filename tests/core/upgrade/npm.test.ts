import { execFile } from 'node:child_process';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  npmGlobalInstall,
  npmGlobalPrefix,
  resolveGlobalBinPath,
} from '../../../src/core/upgrade/npm.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

const mockExecFile = vi.mocked(execFile);

describe('resolveGlobalBinPath', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('on Unix, returns <prefix>/bin/<name>', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');

    const result = resolveGlobalBinPath('/usr/local/lib/node_modules', 'scifi');

    expect(result).toBe('/usr/local/lib/node_modules/bin/scifi');
  });

  it('on Windows, returns <prefix>/<name>.cmd', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    const result = resolveGlobalBinPath('C:\\Users\\user\\AppData\\Roaming\\npm', 'scifi');

    expect(result).toBe('C:\\Users\\user\\AppData\\Roaming\\npm\\scifi.cmd');
  });

  it('on Windows when prefix has no bin subdirectory, returns <prefix>/<name>.cmd', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');

    const result = resolveGlobalBinPath('C:\\Program Files\\nodejs', 'scifi');

    expect(result).toBe('C:\\Program Files\\nodejs\\scifi.cmd');
  });
});

describe('npmGlobalPrefix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns `npm prefix -g`, returns trimmed stdout', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        '/usr/local/lib/node_modules\n',
        '',
      );
      return {} as ReturnType<typeof execFile>;
    });

    const result = await npmGlobalPrefix();

    expect(result).toBe('/usr/local/lib/node_modules');
    expect(mockExecFile).toHaveBeenCalledWith(
      'npm',
      ['prefix', '-g'],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
  });

  it('throws on non-zero exit with npm stderr', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (
        callback as (
          err: { message: string; code?: number },
          stdout: string,
          stderr: string,
        ) => void
      )({ message: 'Command failed', code: 1 }, '', 'npm ERR! something went wrong');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(npmGlobalPrefix()).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('npm ERR! something went wrong') as unknown,
    });
  });
});

describe('npmGlobalInstall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('spawns `npm install -g <package>@latest`, returns stdout/stderr/exitCode on success', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        'added 1 package in 2s\n',
        'npm warn deprecated\n',
      );
      return {} as ReturnType<typeof execFile>;
    });

    const result = await npmGlobalInstall('scifi');

    expect(result).toEqual({
      stdout: 'added 1 package in 2s\n',
      stderr: 'npm warn deprecated\n',
      exitCode: 0,
    });
    expect(mockExecFile).toHaveBeenCalledWith(
      'npm',
      ['install', '-g', 'scifi@latest'],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
  });

  it('throws ScifiError with permission hint when spawn fails with EACCES', async () => {
    const errnoError = Object.assign(new Error('Permission denied'), {
      code: 'EACCES',
    });

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: Error, stdout: string, stderr: string) => void)(errnoError, '', '');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(npmGlobalInstall('scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('Permission denied') as unknown,
      hint: expect.stringContaining('permissions') as unknown,
    });
  });

  it('throws ScifiError with permission hint when spawn fails with EPERM', async () => {
    const errnoError = Object.assign(new Error('Operation not permitted'), {
      code: 'EPERM',
    });

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: Error, stdout: string, stderr: string) => void)(errnoError, '', '');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(npmGlobalInstall('scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('Permission denied') as unknown,
      hint: expect.stringContaining('permissions') as unknown,
    });
  });

  it('throws ScifiError with "npm may not be available" hint when spawn fails with ENOENT', async () => {
    const errnoError = Object.assign(new Error('spawn npm ENOENT'), {
      code: 'ENOENT',
    });

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: Error, stdout: string, stderr: string) => void)(errnoError, '', '');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(npmGlobalInstall('scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('not available') as unknown,
      hint: expect.stringContaining('Install Node.js') as unknown,
    });
  });

  it('throws ScifiError with npm stderr on non-zero exit', async () => {
    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (
        callback as (err: { message: string; code: number }, stdout: string, stderr: string) => void
      )({ message: 'Command failed', code: 1 }, '', 'npm ERR! network error');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(npmGlobalInstall('scifi')).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('npm ERR! network error') as unknown,
    });
  });
});
