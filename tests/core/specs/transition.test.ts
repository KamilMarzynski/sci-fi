import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { updateFeatureStatus } from '../../../src/core/specs/transition.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createFeatureAt(projectRoot: string, slug: string, status: string): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'specflow', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.specflow.json'),
    `${JSON.stringify(
      {
        version: 1,
        id: 'FEAT-0001',
        slug,
        status,
        createdAt: '2026-05-20T00:00:00Z',
        updatedAt: '2026-05-20T00:00:00Z',
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

async function writeSpecMd(projectRoot: string, slug: string): Promise<void> {
  await writeFile(
    join(projectRoot, 'docs', 'specflow', 'specs', slug, 'spec.md'),
    '# Spec\n',
    'utf8',
  );
}

async function writeArchitectureMd(projectRoot: string, slug: string): Promise<void> {
  await writeFile(
    join(projectRoot, 'docs', 'specflow', 'specs', slug, 'design.md'),
    '# Design\n',
    'utf8',
  );
}

async function writeTaskMd(
  projectRoot: string,
  slug: string,
  taskSlug: string,
  taskStatus: string,
): Promise<void> {
  const tasksDir = join(projectRoot, 'docs', 'specflow', 'specs', slug, 'tasks');
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${taskStatus}\ndepends-on: []\n---\n# ${taskSlug}\n`,
    'utf8',
  );
}

describe('updateFeatureStatus', () => {
  it('transitions created to spec-ready when spec.md exists', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'created');
    await writeSpecMd(projectRoot, 'user-auth');

    await updateFeatureStatus(projectRoot, 'user-auth', 'spec-ready', '2026-05-20T10:00:00Z');

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', '.specflow.json'),
        'utf8',
      ),
    ) as { status: string; updatedAt: string };
    expect(metadata.status).toBe('spec-ready');
    expect(metadata.updatedAt).toBe('2026-05-20T10:00:00Z');
  });

  it('transitions plan-ready to in-progress', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'plan-ready');
    await writeSpecMd(projectRoot, 'user-auth');
    await writeArchitectureMd(projectRoot, 'user-auth');
    await writeTaskMd(projectRoot, 'user-auth', 'setup-db', 'pending');

    await updateFeatureStatus(projectRoot, 'user-auth', 'in-progress', '2026-05-20T10:00:00Z');

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', '.specflow.json'),
        'utf8',
      ),
    ) as { status: string };
    expect(metadata.status).toBe('in-progress');
  });

  it('transitions in-progress to done when all tasks are done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'in-progress');
    await writeSpecMd(projectRoot, 'user-auth');
    await writeArchitectureMd(projectRoot, 'user-auth');
    await writeTaskMd(projectRoot, 'user-auth', 'setup-db', 'done');

    await updateFeatureStatus(projectRoot, 'user-auth', 'done', '2026-05-20T10:00:00Z');

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', '.specflow.json'),
        'utf8',
      ),
    ) as { status: string };
    expect(metadata.status).toBe('done');
  });

  it('rejects spec-ready when spec.md is missing', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'created');

    await expect(
      updateFeatureStatus(projectRoot, 'user-auth', 'spec-ready', '2026-05-20T10:00:00Z'),
    ).rejects.toThrow('spec.md is missing');
  });

  it('rejects in-progress when feature is not plan-ready', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'spec-ready');
    await writeSpecMd(projectRoot, 'user-auth');

    await expect(
      updateFeatureStatus(projectRoot, 'user-auth', 'in-progress', '2026-05-20T10:00:00Z'),
    ).rejects.toThrow('must be plan-ready');
  });

  it('rejects done when a task is not done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-transition-'));
    temporaryDirectories.push(projectRoot);
    await createFeatureAt(projectRoot, 'user-auth', 'in-progress');
    await writeSpecMd(projectRoot, 'user-auth');
    await writeArchitectureMd(projectRoot, 'user-auth');
    await writeTaskMd(projectRoot, 'user-auth', 'setup-db', 'in-progress');

    await expect(
      updateFeatureStatus(projectRoot, 'user-auth', 'done', '2026-05-20T10:00:00Z'),
    ).rejects.toThrow('not all tasks are complete');
  });
});
