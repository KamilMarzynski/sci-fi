import { mkdtempSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig, writeConfig } from '../../../src/core/init/config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

describe('writeConfig', () => {
  it('writes config.json with the chosen harnesses array', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });

    await writeConfig({ projectRoot, harnesses: ['claude-code', 'cursor'] });

    const written = JSON.parse(
      readFileSync(join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'), 'utf8'),
    );

    expect(written).toEqual({ version: 1, harnesses: ['claude-code', 'cursor'] });
  });

  it('preserves existing config.json on rerun', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    const { writeFile } = await import('node:fs/promises');
    const configPath = join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json');
    await writeFile(configPath, '{"version":1,"harnesses":["opencode"]}', 'utf8');

    await writeConfig({ projectRoot, harnesses: ['claude-code'] });

    expect(readFileSync(configPath, 'utf8')).toBe('{"version":1,"harnesses":["opencode"]}');
  });
});

describe('readConfig', () => {
  it('returns valid Config for a well-formed config file', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: ['claude-code', 'cursor'] }),
      'utf8',
    );

    const config = await readConfig(projectRoot);

    expect(config).toEqual({ version: 1, harnesses: ['claude-code', 'cursor'] });
  });

  it('throws NOT_FOUND when config file is missing', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    // Do not create the config file or its parent directories.

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'NOT_FOUND',
      message: expect.stringContaining('not initialized') as unknown,
    });
  });

  it('throws INVALID_ARGUMENT when JSON is malformed', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      '{not valid json',
      'utf8',
    );

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INVALID_ARGUMENT',
    });
  });

  it('throws INVALID_ARGUMENT when harnesses key is missing', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1 }),
      'utf8',
    );

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INVALID_ARGUMENT',
    });
  });

  it('throws INVALID_ARGUMENT when harnesses is not an array', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: 'not-an-array' }),
      'utf8',
    );

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INVALID_ARGUMENT',
    });
  });

  it('throws INVALID_ARGUMENT when harnesses contains non-string entries', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: ['claude-code', 42] }),
      'utf8',
    );

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INVALID_ARGUMENT',
    });
  });

  it('filters invalid harness IDs and warns via console.warn', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: ['claude-code', 'unknown-harness', 'cursor'] }),
      'utf8',
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const config = await readConfig(projectRoot);

    expect(config.harnesses).toEqual(['claude-code', 'cursor']);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown-harness'));

    warnSpy.mockRestore();
  });

  it('deduplicates duplicate harness entries', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: ['claude-code', 'cursor', 'claude-code'] }),
      'utf8',
    );

    const config = await readConfig(projectRoot);

    expect(config.harnesses).toEqual(['claude-code', 'cursor']);
  });

  it('throws INVALID_ARGUMENT when harnesses array is empty after filtering', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 1, harnesses: ['unknown-1', 'unknown-2'] }),
      'utf8',
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(readConfig(projectRoot)).rejects.toMatchObject({
      name: 'ScifiError',
      code: 'INVALID_ARGUMENT',
    });

    warnSpy.mockRestore();
  });

  it('handles config with version field present', async () => {
    const projectRoot = mkdtempSync(join(tmpdir(), 'scifi-config-'));
    temporaryDirectories.push(projectRoot);
    await mkdir(join(projectRoot, 'docs', 'scifi', '.scifi'), {
      recursive: true,
    });
    await writeFile(
      join(projectRoot, 'docs', 'scifi', '.scifi', 'config.json'),
      JSON.stringify({ version: 2, harnesses: ['opencode'] }),
      'utf8',
    );

    const config = await readConfig(projectRoot);

    expect(config).toEqual({ version: 2, harnesses: ['opencode'] });
  });
});
