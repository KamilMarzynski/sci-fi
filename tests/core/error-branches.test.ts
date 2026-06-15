import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createFix } from '../../src/core/fixes/create.js';
import { readFixFile } from '../../src/core/fixes/frontmatter.js';
import { findFixById, listFixes } from '../../src/core/fixes/list.js';
import { readConfig, writeConfig } from '../../src/core/init/config.js';
import { scaffoldInit } from '../../src/core/init/scaffold.js';
import { createFeature } from '../../src/core/specs/create.js';
import { inspectFeatureLifecycle } from '../../src/core/specs/lifecycle.js';
import { listFeatures } from '../../src/core/specs/list.js';
import { updateFeatureStatus } from '../../src/core/specs/transition.js';
import { readTaskFile } from '../../src/core/tasks/frontmatter.js';
import { listTasks } from '../../src/core/tasks/list.js';
import { updateTaskStatus } from '../../src/core/tasks/transition.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function project(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scifi-err-'));
  temporaryDirectories.push(root);
  return root;
}

const VALID_METADATA = JSON.stringify({
  version: 1,
  slug: 'x',
  status: 'created',
  createdAt: '2026-05-21T00:00:00Z',
  updatedAt: '2026-05-21T00:00:00Z',
});

describe('specs/create createFeature', () => {
  it('rethrows non-ENOENT stat errors', async () => {
    const root = await project();
    await mkdir(join(root, 'docs', 'scifi'), { recursive: true });
    // "specs" is a file, so stat on specs/<slug> yields ENOTDIR (not ENOENT).
    await writeFile(join(root, 'docs', 'scifi', 'specs'), 'not a directory', 'utf8');

    await expect(
      createFeature({ projectRoot: root, slug: 'x', now: '2026-05-21T00:00:00Z' }),
    ).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('specs/list listFeatures', () => {
  it('rethrows non-ENOENT readdir errors', async () => {
    const root = await project();
    await mkdir(join(root, 'docs', 'scifi'), { recursive: true });
    await writeFile(join(root, 'docs', 'scifi', 'specs'), 'not a directory', 'utf8');

    await expect(listFeatures({ projectRoot: root })).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('specs/lifecycle inspectFeatureLifecycle', () => {
  it('rethrows non-ENOENT errors when reading metadata', async () => {
    const root = await project();
    // Make the metadata path a directory so readFile yields EISDIR.
    await mkdir(join(root, 'docs', 'scifi', 'specs', 'x', '.scifi.json'), { recursive: true });

    await expect(inspectFeatureLifecycle(root, 'x')).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('throws INTERNAL when metadata is not an object', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '.scifi.json'), '42', 'utf8');

    await expect(inspectFeatureLifecycle(root, 'x')).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('rethrows non-ENOENT errors when listing the tasks directory', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '.scifi.json'), VALID_METADATA, 'utf8');
    // "tasks" is a file, so readdir yields ENOTDIR.
    await writeFile(join(dir, 'tasks'), 'not a directory', 'utf8');

    await expect(inspectFeatureLifecycle(root, 'x')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('fixes/create createFix', () => {
  it('rethrows non-ENOENT stat errors', async () => {
    const root = await project();
    await mkdir(join(root, 'docs', 'scifi', 'specs'), { recursive: true });
    // Feature path is a file, so stat on <feature>/.scifi.json yields ENOTDIR.
    await writeFile(join(root, 'docs', 'scifi', 'specs', 'x'), 'not a directory', 'utf8');

    await expect(
      createFix({ projectRoot: root, description: 'oops', featureSlug: 'x', now: 'now' }),
    ).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('fixes/list', () => {
  it('listFixes rethrows non-ENOENT readdir errors', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'fixes'), 'not a directory', 'utf8');

    await expect(listFixes(root, 'x')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });

  it('findFixById rethrows non-ENOENT readdir errors', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'fixes'), 'not a directory', 'utf8');

    await expect(findFixById(root, 'x', 'FIX-0001')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('fixes/frontmatter readFixFile', () => {
  it('rejects frontmatter that is not an object', async () => {
    const root = await project();
    const file = join(root, 'fix.md');
    await writeFile(file, '---\n42\n---\n# body\n', 'utf8');

    await expect(readFixFile(file)).rejects.toThrow(/invalid frontmatter/);
  });
});

describe('tasks/frontmatter readTaskFile', () => {
  it('rejects frontmatter that is not an object', async () => {
    const root = await project();
    const file = join(root, 'task.md');
    await writeFile(file, '---\n42\n---\n# body\n', 'utf8');

    await expect(readTaskFile(file)).rejects.toThrow(/invalid frontmatter/);
  });
});

describe('tasks/list listTasks', () => {
  it('rethrows non-ENOENT readdir errors', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'tasks'), 'not a directory', 'utf8');

    await expect(listTasks(root, 'x')).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});

describe('init/config', () => {
  it('readConfig rethrows non-ENOENT read errors', async () => {
    const root = await project();
    // config.json is a directory, so readFile yields EISDIR.
    await mkdir(join(root, 'docs', 'scifi', '.scifi', 'config.json'), { recursive: true });

    await expect(readConfig(root)).rejects.toMatchObject({ code: 'EISDIR' });
  });

  it('writeConfig rethrows non-EEXIST write errors', async () => {
    const root = await project();
    // The .scifi directory does not exist, so writeFile yields ENOENT.
    await expect(
      writeConfig({ projectRoot: root, harnesses: ['claude-code'] }),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

describe('tasks/transition updateTaskStatus', () => {
  it('rethrows non-ENOENT errors when reading the task file', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(dir, { recursive: true });
    // "tasks" is a file, so reading tasks/<task>.md yields ENOTDIR.
    await writeFile(join(dir, 'tasks'), 'not a directory', 'utf8');

    await expect(updateTaskStatus(root, 'x', 'thing', 'in-progress')).rejects.toMatchObject({
      code: 'ENOTDIR',
    });
  });
});

describe('specs/list listFeatures filtering', () => {
  it('skips features whose metadata is not a valid object', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'bad');
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, '.scifi.json'), '42', 'utf8');

    await expect(listFeatures({ projectRoot: root })).resolves.toEqual([]);
  });
});

describe('specs/transition updateFeatureStatus metadata fields', () => {
  it('preserves title, branch, and worktreePath when present', async () => {
    const root = await project();
    const dir = join(root, 'docs', 'scifi', 'specs', 'x');
    await mkdir(join(dir, 'tasks'), { recursive: true });
    await writeFile(join(dir, 'spec.md'), '# spec\n', 'utf8');
    await writeFile(
      join(dir, '.scifi.json'),
      JSON.stringify({
        version: 1,
        slug: 'x',
        title: 'Example',
        status: 'created',
        createdAt: '2026-05-21T00:00:00Z',
        updatedAt: '2026-05-21T00:00:00Z',
        branch: 'feat/x',
        worktreePath: '/tmp/wt/x',
      }),
      'utf8',
    );

    const result = await updateFeatureStatus(root, 'x', 'spec-ready', '2026-06-01T00:00:00Z');

    expect(result.newStatus).toBe('spec-ready');
    const written = JSON.parse(
      await (await import('node:fs/promises')).readFile(join(dir, '.scifi.json'), 'utf8'),
    );
    expect(written).toMatchObject({
      title: 'Example',
      branch: 'feat/x',
      worktreePath: '/tmp/wt/x',
      status: 'spec-ready',
    });
  });
});

describe('init/scaffold scaffoldInit', () => {
  it('rethrows non-ENOENT errors while validating scaffold directories', async () => {
    const root = await project();
    await mkdir(join(root, 'docs'), { recursive: true });
    // docs/scifi is a file, so stat on docs/scifi/.scifi yields ENOTDIR.
    await writeFile(join(root, 'docs', 'scifi'), 'not a directory', 'utf8');

    await expect(scaffoldInit({ projectRoot: root })).rejects.toMatchObject({ code: 'ENOTDIR' });
  });
});
