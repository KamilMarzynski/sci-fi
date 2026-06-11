import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listFeatures } from '../../../src/core/specs/list.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

function makeMetadata(slug: string, status: string): string {
  return `${JSON.stringify(
    {
      version: 1,
      slug,
      status,
      createdAt: '2026-05-20T00:00:00Z',
      updatedAt: '2026-05-20T00:00:00Z',
    },
    null,
    2,
  )}\n`;
}

describe('listFeatures', () => {
  it('returns empty array when specs directory does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    temporaryDirectories.push(projectRoot);

    const features = await listFeatures({ projectRoot });
    expect(features).toEqual([]);
  });

  it('returns metadata for all feature directories', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    temporaryDirectories.push(projectRoot);
    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');

    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await mkdir(join(specsDir, 'payment-flow'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
      makeMetadata('user-auth', 'created'),
      'utf8',
    );
    await writeFile(
      join(specsDir, 'payment-flow', '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const features = await listFeatures({ projectRoot });
    expect(features).toHaveLength(2);

    const slugs = features.map((f) => f.slug).sort();
    expect(slugs).toEqual(['payment-flow', 'user-auth']);
  });

  it('filters features by status', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    temporaryDirectories.push(projectRoot);
    const specsDir = join(projectRoot, 'docs', 'scifi', 'specs');

    await mkdir(join(specsDir, 'user-auth'), { recursive: true });
    await mkdir(join(specsDir, 'payment-flow'), { recursive: true });
    await writeFile(
      join(specsDir, 'user-auth', '.scifi.json'),
      makeMetadata('user-auth', 'created'),
      'utf8',
    );
    await writeFile(
      join(specsDir, 'payment-flow', '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const features = await listFeatures({ projectRoot, status: 'spec-ready' });
    expect(features).toHaveLength(1);
    expect(features[0]?.slug).toBe('payment-flow');
  });
});
