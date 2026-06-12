import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readPackageVersion } from '../../src/core/package-version.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { force: true, recursive: true })),
  );
  temporaryDirectories.length = 0;
});

describe('readPackageVersion', () => {
  it('returns version string for valid package.json', async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'scifi-pkgver-'));
    temporaryDirectories.push(packageRoot);
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'scifi', version: '1.2.3' }),
      'utf8',
    );

    expect(readPackageVersion(packageRoot)).toBe('1.2.3');
  });

  it('throws when version field is missing', async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'scifi-pkgver-'));
    temporaryDirectories.push(packageRoot);
    await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: 'scifi' }), 'utf8');

    expect(() => readPackageVersion(packageRoot)).toThrow();
  });

  it('throws when version is not a string', async () => {
    const packageRoot = mkdtempSync(join(tmpdir(), 'scifi-pkgver-'));
    temporaryDirectories.push(packageRoot);
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({ name: 'scifi', version: 42 }),
      'utf8',
    );

    expect(() => readPackageVersion(packageRoot)).toThrow();
  });
});
