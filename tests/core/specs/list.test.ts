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

    const slugs = features.map((f) => f.metadata.slug).sort();
    expect(slugs).toEqual(['payment-flow', 'user-auth']);
    expect(features.every((f) => f.location === 'local')).toBe(true);
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
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe('local');
  });

  it('includes a feature from a linked worktree when it is absent locally', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeSpecsDir, { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe(`worktree:${worktreePath}`);
  });

  it('prefers local metadata when the same slug also exists in a worktree', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const localSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(localSpecsDir, { recursive: true });
    await writeFile(
      join(localSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'created'),
      'utf8',
    );

    const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeSpecsDir, { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.metadata.status).toBe('created');
    expect(features[0]?.location).toBe('local');
  });

  it('selects the lexicographically smallest worktree path for duplicate worktree slugs', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const alphaPath = await mkdtemp(join(tmpdir(), 'scifi-list-alpha-'));
    const betaPath = await mkdtemp(join(tmpdir(), 'scifi-list-beta-'));
    temporaryDirectories.push(projectRoot, alphaPath, betaPath);

    for (const worktreePath of [betaPath, alphaPath]) {
      const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
      await mkdir(worktreeSpecsDir, { recursive: true });
      await writeFile(
        join(worktreeSpecsDir, '.scifi.json'),
        makeMetadata('payment-flow', 'spec-ready'),
        'utf8',
      );
    }

    const fakeProvider = {
      discover: async () => [
        { path: betaPath, isCurrent: false },
        { path: alphaPath, isCurrent: false },
      ],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe(`worktree:${alphaPath}`);
  });

  it('applies the status filter to worktree-only features after merging', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const localSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(localSpecsDir, { recursive: true });
    await writeFile(
      join(localSpecsDir, '.scifi.json'),
      makeMetadata('user-auth', 'created'),
      'utf8',
    );

    const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeSpecsDir, { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const features = await listFeatures({
      projectRoot,
      status: 'spec-ready',
      worktreeProvider: fakeProvider,
    });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe(`worktree:${worktreePath}`);
  });

  it('sorts results alphabetically by slug regardless of location', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const localSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(localSpecsDir, { recursive: true });
    await writeFile(
      join(localSpecsDir, '.scifi.json'),
      makeMetadata('user-auth', 'created'),
      'utf8',
    );

    const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeSpecsDir, { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    const slugs = features.map((f) => f.metadata.slug);
    expect(slugs).toEqual(['payment-flow', 'user-auth']);
  });

  it('does not duplicate a local feature as a worktree entry when the current checkout is reported', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    temporaryDirectories.push(projectRoot);

    const localSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(localSpecsDir, { recursive: true });
    await writeFile(
      join(localSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'created'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: projectRoot, isCurrent: true }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe('local');
  });

  it('skips a worktree path that no longer exists on disk', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const removedWorktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-removed-'));
    await rm(removedWorktreePath, { recursive: true, force: true });
    temporaryDirectories.push(projectRoot);

    const fakeProvider = {
      discover: async () => [{ path: removedWorktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toEqual([]);
  });

  it('falls back to local-only output when the provider returns an empty array', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    temporaryDirectories.push(projectRoot);

    const localSpecsDir = join(projectRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(localSpecsDir, { recursive: true });
    await writeFile(
      join(localSpecsDir, '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
    expect(features[0]?.location).toBe('local');
  });

  it('skips a worktree whose specs directory is missing', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const emptyWorktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-empty-'));
    temporaryDirectories.push(projectRoot, emptyWorktreePath);

    const fakeProvider = {
      discover: async () => [{ path: emptyWorktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toEqual([]);
  });

  it('skips invalid metadata in a worktree while keeping valid entries', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-list-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-list-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const worktreeSpecsDir = join(worktreePath, 'docs', 'scifi', 'specs');
    await mkdir(join(worktreeSpecsDir, 'payment-flow'), { recursive: true });
    await writeFile(
      join(worktreeSpecsDir, 'payment-flow', '.scifi.json'),
      makeMetadata('payment-flow', 'spec-ready'),
      'utf8',
    );
    await mkdir(join(worktreeSpecsDir, 'corrupt'), { recursive: true });
    await writeFile(join(worktreeSpecsDir, 'corrupt', '.scifi.json'), 'not-json', 'utf8');

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const features = await listFeatures({ projectRoot, worktreeProvider: fakeProvider });
    expect(features).toHaveLength(1);
    expect(features[0]?.metadata.slug).toBe('payment-flow');
  });
});
