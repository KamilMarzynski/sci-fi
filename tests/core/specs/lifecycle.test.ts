import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  inspectFeatureLifecycle,
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
        id: 'FEAT-0001',
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
        id: 'FEAT-0001',
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
