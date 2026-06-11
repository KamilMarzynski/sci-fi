import { mkdtempSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeConfig } from '../../../src/core/init/config.js';

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
