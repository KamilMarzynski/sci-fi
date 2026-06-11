import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { updateFeatureStatus } from '../../../src/core/specs/transition.js';
import { setFeatureWorktree } from '../../../src/core/specs/worktree.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createFeatureAt(projectRoot: string, slug: string): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
    `${JSON.stringify(
      {
        version: 1,
        id: 'FEAT-0001',
        slug,
        status: 'created',
        createdAt: '2026-06-11T00:00:00Z',
        updatedAt: '2026-06-11T00:00:00Z',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function readMetadata(
  projectRoot: string,
  slug: string,
): Promise<{ branch?: string; worktreePath?: string; status: string }> {
  const raw = await readFile(
    join(projectRoot, 'docs', 'scifi', 'specs', slug, '.scifi.json'),
    'utf8',
  );
  return JSON.parse(raw) as { branch?: string; worktreePath?: string; status: string };
}

describe('setFeatureWorktree', () => {
  it('records branch and worktree path on the feature metadata', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');

    const result = await setFeatureWorktree(projectRoot, 'google-auth', {
      branch: 'feat/google-auth',
      path: '.worktrees/feat-google-auth',
    });

    expect(result).toEqual({
      id: 'FEAT-0001',
      slug: 'google-auth',
      branch: 'feat/google-auth',
      worktreePath: '.worktrees/feat-google-auth',
    });

    const metadata = await readMetadata(projectRoot, 'google-auth');
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
    expect(metadata.status).toBe('created');
  });

  it('rejects an empty branch', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');

    await expect(
      setFeatureWorktree(projectRoot, 'google-auth', { branch: '   ', path: '.worktrees/x' }),
    ).rejects.toThrow('Branch must not be empty');
  });

  it('rejects an empty worktree path', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');

    await expect(
      setFeatureWorktree(projectRoot, 'google-auth', { branch: 'feat/google-auth', path: '  ' }),
    ).rejects.toThrow('Worktree path must not be empty');
  });

  it('throws NOT_FOUND for a missing feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);

    await expect(
      setFeatureWorktree(projectRoot, 'ghost', {
        branch: 'feat/ghost',
        path: '.worktrees/feat-ghost',
      }),
    ).rejects.toThrow('does not exist');
  });

  it('preserves the worktree pointer across a status transition', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'google-auth');
    await writeFile(
      join(projectRoot, 'docs', 'scifi', 'specs', 'google-auth', 'spec.md'),
      '# Spec\n',
      'utf8',
    );
    await setFeatureWorktree(projectRoot, 'google-auth', {
      branch: 'feat/google-auth',
      path: '.worktrees/feat-google-auth',
    });

    await updateFeatureStatus(projectRoot, 'google-auth', 'spec-ready', '2026-06-11T10:00:00Z');

    const metadata = await readMetadata(projectRoot, 'google-auth');
    expect(metadata.status).toBe('spec-ready');
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
  });
});
