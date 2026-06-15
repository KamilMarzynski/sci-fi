import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  inspectFeatureLifecycle,
  resolveFeatureLifecycle,
  validateStatusTransition,
} from '../../../src/core/specs/lifecycle.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })),
  );
  temporaryDirectories.length = 0;
});

describe('inspectFeatureLifecycle', () => {
  it('treats created plus spec.md as a draft awaiting acceptance', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');

    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );
    await writeFile(join(featureRoot, 'spec.md'), '# User Auth\n', 'utf8');

    const lifecycle = await inspectFeatureLifecycle(projectRoot, 'user-auth');

    expect(lifecycle.metadata.status).toBe('created');
    expect(lifecycle.artifacts.specExists).toBe(true);
    expect(lifecycle.artifacts.designExists).toBe(false);
    expect(lifecycle.artifacts.taskFileCount).toBe(0);
  });

  it('counts .md files in tasks/ directory', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    const tasksDir = join(featureRoot, 'tasks');

    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(featureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );
    await writeFile(join(tasksDir, 'task-01.md'), '# Task 1\n', 'utf8');
    await writeFile(join(tasksDir, 'task-02.md'), '# Task 2\n', 'utf8');
    await writeFile(join(tasksDir, 'not-a-task.txt'), 'text\n', 'utf8');

    const lifecycle = await inspectFeatureLifecycle(projectRoot, 'user-auth');

    expect(lifecycle.artifacts.taskFileCount).toBe(2);
  });

  it('throws when metadata file is invalid', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');

    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, '.scifi.json'),
      `${JSON.stringify({ invalid: true })}\n`,
      'utf8',
    );

    await expect(inspectFeatureLifecycle(projectRoot, 'user-auth')).rejects.toThrow(
      'Invalid metadata file at',
    );
  });

  it('rethrows unexpected read errors from metadata file', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');

    await mkdir(featureRoot, { recursive: true });
    await chmod(featureRoot, 0o000);

    await expect(inspectFeatureLifecycle(projectRoot, 'user-auth')).rejects.toThrow(
      /EACCES|EPERM|permission/i,
    );

    await chmod(featureRoot, 0o755);
  });
});

describe('resolveFeatureLifecycle', () => {
  it('returns local lifecycle with location local when metadata exists locally', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');

    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'user-auth', fakeProvider);

    expect(resolved.lifecycle.metadata.status).toBe('created');
    expect(resolved.location).toBe('local');
  });

  it('falls back to a linked worktree when the feature is absent locally', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const worktreeFeatureRoot = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeFeatureRoot, { recursive: true });
    await writeFile(
      join(worktreeFeatureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'payment-flow',
        status: 'spec-ready',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider);

    expect(resolved.lifecycle.metadata.status).toBe('spec-ready');
    expect(resolved.location).toBe(`worktree:${worktreePath}`);
  });

  it('prefers the local copy when the same slug also exists in a worktree', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const localFeatureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(localFeatureRoot, { recursive: true });
    await writeFile(
      join(localFeatureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'payment-flow',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const worktreeFeatureRoot = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeFeatureRoot, { recursive: true });
    await writeFile(
      join(worktreeFeatureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'payment-flow',
        status: 'spec-ready',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider);

    expect(resolved.lifecycle.metadata.status).toBe('created');
    expect(resolved.location).toBe('local');
  });

  it('throws the original NOT_FOUND error when the feature is absent everywhere', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    await expect(
      resolveFeatureLifecycle(projectRoot, 'missing-feature', fakeProvider),
    ).rejects.toThrow('Feature "missing-feature" does not exist.');
  });

  it('selects the lexicographically smallest worktree path for duplicate worktree slugs', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const alphaPath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-alpha-'));
    const betaPath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-beta-'));
    temporaryDirectories.push(projectRoot, alphaPath, betaPath);

    for (const worktreePath of [betaPath, alphaPath]) {
      const featureRoot = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
      await mkdir(featureRoot, { recursive: true });
      await writeFile(
        join(featureRoot, '.scifi.json'),
        `${JSON.stringify({
          version: 1,
          slug: 'payment-flow',
          status: 'spec-ready',
          createdAt: '2026-05-20T06:29:55Z',
          updatedAt: '2026-05-20T06:29:55Z',
        })}\n`,
        'utf8',
      );
    }

    const fakeProvider = {
      discover: async () => [
        { path: betaPath, isCurrent: false },
        { path: alphaPath, isCurrent: false },
      ],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider);

    expect(resolved.location).toBe(`worktree:${alphaPath}`);
  });

  it('ignores the current worktree entry in the provider results', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const currentWorktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-current-'));
    temporaryDirectories.push(projectRoot, currentWorktreePath);

    const featureRoot = join(currentWorktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(featureRoot, { recursive: true });
    await writeFile(
      join(featureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'payment-flow',
        status: 'spec-ready',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: currentWorktreePath, isCurrent: true }],
    };

    await expect(
      resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider),
    ).rejects.toThrow('Feature "payment-flow" does not exist.');
  });

  it('does not duplicate a local feature as a worktree entry when the current checkout is reported', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);

    const localFeatureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(localFeatureRoot, { recursive: true });
    await writeFile(
      join(localFeatureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'payment-flow',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [{ path: projectRoot, isCurrent: true }],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider);

    expect(resolved.lifecycle.metadata.status).toBe('created');
    expect(resolved.location).toBe('local');
  });

  it('skips a worktree path that no longer exists on disk', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const removedWorktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-removed-'));
    await rm(removedWorktreePath, { recursive: true, force: true });
    temporaryDirectories.push(projectRoot);

    const fakeProvider = {
      discover: async () => [{ path: removedWorktreePath, isCurrent: false }],
    };

    await expect(
      resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider),
    ).rejects.toThrow('Feature "payment-flow" does not exist.');
  });

  it('falls back to local-only output when the provider returns an empty array', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);

    const localFeatureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(localFeatureRoot, { recursive: true });
    await writeFile(
      join(localFeatureRoot, '.scifi.json'),
      `${JSON.stringify({
        version: 1,
        slug: 'user-auth',
        status: 'created',
        createdAt: '2026-05-20T06:29:55Z',
        updatedAt: '2026-05-20T06:29:55Z',
      })}\n`,
      'utf8',
    );

    const fakeProvider = {
      discover: async () => [],
    };

    const resolved = await resolveFeatureLifecycle(projectRoot, 'user-auth', fakeProvider);

    expect(resolved.lifecycle.metadata.status).toBe('created');
    expect(resolved.location).toBe('local');
  });

  it('rethrows non-NOT_FOUND errors without consulting the provider', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    temporaryDirectories.push(projectRoot);

    const localFeatureRoot = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(localFeatureRoot, { recursive: true });
    await chmod(localFeatureRoot, 0o000);

    const fakeProvider = {
      discover: async () => [{ path: '/unused', isCurrent: false }],
    };

    await expect(resolveFeatureLifecycle(projectRoot, 'user-auth', fakeProvider)).rejects.toThrow(
      /EACCES|EPERM|permission/i,
    );

    await chmod(localFeatureRoot, 0o755);
  });

  it('rethrows non-NOT_FOUND errors encountered during worktree fallback', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-'));
    const worktreePath = await mkdtemp(join(tmpdir(), 'scifi-lifecycle-worktree-'));
    temporaryDirectories.push(projectRoot, worktreePath);

    const worktreeFeatureRoot = join(worktreePath, 'docs', 'scifi', 'specs', 'payment-flow');
    await mkdir(worktreeFeatureRoot, { recursive: true });
    await chmod(worktreeFeatureRoot, 0o000);

    const fakeProvider = {
      discover: async () => [{ path: worktreePath, isCurrent: false }],
    };

    await expect(
      resolveFeatureLifecycle(projectRoot, 'payment-flow', fakeProvider),
    ).rejects.toThrow(/EACCES|EPERM|permission/i);

    await chmod(worktreeFeatureRoot, 0o755);
  });
});

describe('validateStatusTransition', () => {
  it('rejects spec-ready when spec.md is missing', async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: false,
          designExists: true,
          taskFileCount: 1,
        },
        'spec-ready',
      ),
    ).rejects.toThrow('Cannot mark feature as spec-ready: spec.md is missing.');
  });

  it('rejects plan-ready when design.md is missing', async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: true,
          designExists: false,
          taskFileCount: 1,
        },
        'plan-ready',
      ),
    ).rejects.toThrow('Cannot mark feature as plan-ready: design.md is missing.');
  });

  it('rejects plan-ready when task files are missing', async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: true,
          designExists: true,
          taskFileCount: 0,
        },
        'plan-ready',
      ),
    ).rejects.toThrow('Cannot mark feature as plan-ready: no task files were found.');
  });

  it('accepts valid spec-ready transition', async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: true,
          designExists: false,
          taskFileCount: 0,
        },
        'spec-ready',
      ),
    ).resolves.toBeUndefined();
  });

  it('accepts valid plan-ready transition', async () => {
    await expect(
      validateStatusTransition(
        {
          specExists: true,
          designExists: true,
          taskFileCount: 1,
        },
        'plan-ready',
      ),
    ).resolves.toBeUndefined();
  });

  it('does not throw for statuses with no rules', async () => {
    const artifacts = {
      specExists: false,
      designExists: false,
      taskFileCount: 0,
    };

    await expect(validateStatusTransition(artifacts, 'created')).resolves.toBeUndefined();
    await expect(validateStatusTransition(artifacts, 'in-progress')).resolves.toBeUndefined();
    await expect(validateStatusTransition(artifacts, 'done')).resolves.toBeUndefined();
  });
});

describe('validateStatusTransition with context', () => {
  it('rejects in-progress when current status is not plan-ready', async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, designExists: true, taskFileCount: 1 },
        'in-progress',
        { currentStatus: 'spec-ready' },
      ),
    ).rejects.toThrow(
      'Cannot start feature: feature must be plan-ready before starting implementation.',
    );
  });

  it('accepts in-progress when current status is plan-ready', async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, designExists: true, taskFileCount: 1 },
        'in-progress',
        { currentStatus: 'plan-ready' },
      ),
    ).resolves.toBeUndefined();
  });

  it('accepts in-progress when already in-progress (idempotent resume)', async () => {
    await expect(
      validateStatusTransition(
        { specExists: true, designExists: true, taskFileCount: 1 },
        'in-progress',
        { currentStatus: 'in-progress' },
      ),
    ).resolves.toBeUndefined();
  });

  it('rejects done when allTasksDone is false', async () => {
    await expect(
      validateStatusTransition({ specExists: true, designExists: true, taskFileCount: 1 }, 'done', {
        allTasksDone: false,
      }),
    ).rejects.toThrow('Cannot mark feature as done: not all tasks are complete.');
  });

  it('accepts done when allTasksDone is true', async () => {
    await expect(
      validateStatusTransition({ specExists: true, designExists: true, taskFileCount: 1 }, 'done', {
        allTasksDone: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not apply in-progress rule when context is absent', async () => {
    await expect(
      validateStatusTransition(
        { specExists: false, designExists: false, taskFileCount: 0 },
        'in-progress',
      ),
    ).resolves.toBeUndefined();
  });

  it('does not apply done rule when context is absent', async () => {
    await expect(
      validateStatusTransition(
        { specExists: false, designExists: false, taskFileCount: 0 },
        'done',
      ),
    ).resolves.toBeUndefined();
  });
});
