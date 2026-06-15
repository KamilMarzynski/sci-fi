import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadCatalog } from '../../../src/core/skills/catalog.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scifi-catalog-'));
  temporaryDirectories.push(root);
  return root;
}

describe('loadCatalog error branches', () => {
  it('throws when a manifest module has no `manifest` export', async () => {
    const root = await tempRoot();
    const skill = join(root, 'sf-x');
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, 'body.md'), '# body\n', 'utf8');
    await writeFile(join(skill, 'manifest.js'), 'export const notManifest = {};\n', 'utf8');

    await expect(loadCatalog({ bodiesRoot: root, manifestsRoot: root })).rejects.toThrow(
      /manifest export missing/,
    );
  });

  it('rethrows non-ENOENT errors when locating the manifest file', async () => {
    const bodiesRoot = await tempRoot();
    const manifestsRoot = await tempRoot();
    const skill = join(bodiesRoot, 'sf-x');
    await mkdir(skill, { recursive: true });
    await writeFile(join(skill, 'body.md'), '# body\n', 'utf8');
    // In manifestsRoot, "sf-x" is a file, so stat on sf-x/manifest.js yields ENOTDIR.
    await writeFile(join(manifestsRoot, 'sf-x'), 'not a directory', 'utf8');

    await expect(loadCatalog({ bodiesRoot, manifestsRoot })).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
});
