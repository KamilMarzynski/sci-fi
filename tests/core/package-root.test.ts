import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { findPackageRoot } from '../../src/core/package-root.js';

async function makeTree(): Promise<{ root: string; nested: string }> {
  const root = await mkdtemp(join(tmpdir(), 'scifi-pkgroot-'));
  await writeFile(join(root, 'package.json'), '{"name":"fixture"}');
  const nested = join(root, 'dist', 'src', 'cli');
  await mkdir(nested, { recursive: true });
  return { root, nested };
}

describe('findPackageRoot', () => {
  it('walks up from a deep path to the package.json owner', async () => {
    const { root, nested } = await makeTree();
    const sentinel = join(nested, 'index.js');
    await writeFile(sentinel, '');

    expect(findPackageRoot(pathToFileURL(sentinel).href)).toBe(root);
  });

  it('returns the nearest package.json when multiple exist', async () => {
    const { root, nested } = await makeTree();
    // Add an inner package.json closer to the sentinel; walk-up must stop there.
    const innerRoot = join(root, 'dist');
    await writeFile(join(innerRoot, 'package.json'), '{"name":"inner"}');
    const sentinel = join(nested, 'index.js');
    await writeFile(sentinel, '');

    expect(findPackageRoot(pathToFileURL(sentinel).href)).toBe(innerRoot);
  });

  it('accepts a URL instance', async () => {
    const { root, nested } = await makeTree();
    const sentinel = join(nested, 'index.js');
    await writeFile(sentinel, '');

    expect(findPackageRoot(pathToFileURL(sentinel))).toBe(root);
  });

  it('throws if no package.json exists above the start path', async () => {
    const orphan = await mkdtemp(join(tmpdir(), 'scifi-orphan-'));
    const sentinel = join(orphan, 'lonely.js');
    await writeFile(sentinel, '');

    expect(() => findPackageRoot(pathToFileURL(sentinel).href)).toThrow(/No package\.json/);
  });
});
