import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSkillInstall } from '../../../src/core/upgrade/child.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn(),
  };
});

vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(),
  };
});

const mockExecFile = vi.mocked(execFile);
const mockExistsSync = vi.mocked(existsSync);

describe('spawnSkillInstall', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('spawns <binPath> upgrade --_install --project-root <root> --harnesses <ids>, parses stdout JSON into InstallReport', async () => {
    mockExistsSync.mockReturnValue(true);

    const installReport = {
      installed: [
        { harness: 'claude-code', baseDir: '/some/dir', skills: ['sf-fix', 'sf-feature'] },
      ],
      failed: [],
    };

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        JSON.stringify(installReport),
        '',
      );
      return {} as ReturnType<typeof execFile>;
    });

    const result = await spawnSkillInstall({
      binPath: '/usr/local/bin/scifi',
      projectRoot: '/my/project',
      harnesses: ['claude-code', 'opencode'],
    });

    expect(result).toEqual(installReport);
    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/local/bin/scifi',
      [
        'upgrade',
        '--_install',
        '--project-root',
        '/my/project',
        '--harnesses',
        'claude-code,opencode',
      ],
      expect.objectContaining({ shell: false }),
      expect.any(Function),
    );
  });

  it('throws when binary does not exist at binPath (checked via existsSync before spawn)', async () => {
    mockExistsSync.mockReturnValue(false);

    await expect(
      spawnSkillInstall({
        binPath: '/nonexistent/scifi',
        projectRoot: '/my/project',
        harnesses: ['claude-code'],
      }),
    ).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('/nonexistent/scifi') as unknown,
      hint: expect.stringContaining('Re-run') as unknown,
    });

    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('throws ScifiError with child stderr when child exits non-zero', async () => {
    mockExistsSync.mockReturnValue(true);

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (
        callback as (err: { message: string; code: number }, stdout: string, stderr: string) => void
      )({ message: 'Command failed', code: 1 }, '', 'skill install error: permission denied');
      return {} as ReturnType<typeof execFile>;
    });

    await expect(
      spawnSkillInstall({
        binPath: '/usr/local/bin/scifi',
        projectRoot: '/my/project',
        harnesses: ['claude-code'],
      }),
    ).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('skill install error: permission denied') as unknown,
    });
  });

  it('throws ScifiError when child stdout is not valid JSON', async () => {
    mockExistsSync.mockReturnValue(true);

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        'some garbage not json',
        '',
      );
      return {} as ReturnType<typeof execFile>;
    });

    await expect(
      spawnSkillInstall({
        binPath: '/usr/local/bin/scifi',
        projectRoot: '/my/project',
        harnesses: ['claude-code'],
      }),
    ).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INTERNAL',
      message: expect.stringContaining('unparseable') as unknown,
    });
  });

  it('passes harnesses as comma-separated --harnesses argument', async () => {
    mockExistsSync.mockReturnValue(true);

    mockExecFile.mockImplementation((_file, _args, _options, callback) => {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        JSON.stringify({ installed: [], failed: [] }),
        '',
      );
      return {} as ReturnType<typeof execFile>;
    });

    await spawnSkillInstall({
      binPath: '/usr/local/bin/scifi',
      projectRoot: '/my/project',
      harnesses: ['claude-code', 'opencode', 'codex'],
    });

    expect(mockExecFile).toHaveBeenCalledWith(
      '/usr/local/bin/scifi',
      expect.arrayContaining(['--harnesses', 'claude-code,opencode,codex']),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
