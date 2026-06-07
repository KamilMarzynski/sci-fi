import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTaskFile } from '../../../src/core/tasks/frontmatter.js';
import { buildTaskFilePath } from '../../../src/core/tasks/paths.js';
import { updateTaskStatus } from '../../../src/core/tasks/transition.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function createTaskFile(
  projectRoot: string,
  featureSlug: string,
  taskSlug: string,
  status: string,
): Promise<void> {
  const tasksDir = join(projectRoot, 'docs', 'specflow', 'specs', featureSlug, 'tasks');
  await mkdir(tasksDir, { recursive: true });
  await writeFile(
    join(tasksDir, `${taskSlug}.md`),
    `---\nid: TASK-001\nslug: ${taskSlug}\nstatus: ${status}\ndepends-on: []\n---\n# ${taskSlug}\n`,
    'utf8',
  );
}

describe('updateTaskStatus', () => {
  it('marks a pending task as in-progress', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-task-transition-'));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, 'user-auth', 'setup-database', 'pending');

    await updateTaskStatus(projectRoot, 'user-auth', 'setup-database', 'in-progress');

    const filePath = buildTaskFilePath(projectRoot, 'user-auth', 'setup-database');
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe('in-progress');
  });

  it('marks an in-progress task as done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-task-transition-'));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, 'user-auth', 'setup-database', 'in-progress');

    await updateTaskStatus(projectRoot, 'user-auth', 'setup-database', 'done');

    const filePath = buildTaskFilePath(projectRoot, 'user-auth', 'setup-database');
    const file = await readTaskFile(filePath);
    expect(file.frontmatter.status).toBe('done');
  });

  it('preserves body content when updating status', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-task-transition-'));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'setup-database.md'),
      `---\nid: TASK-001\nslug: setup-database\nstatus: pending\ndepends-on: []\n---\n# Setup Database\n\nDetailed description.\n`,
      'utf8',
    );

    await updateTaskStatus(projectRoot, 'user-auth', 'setup-database', 'in-progress');

    const filePath = buildTaskFilePath(projectRoot, 'user-auth', 'setup-database');
    const file = await readTaskFile(filePath);
    expect(file.body).toBe('# Setup Database\n\nDetailed description.\n');
  });

  it('rejects marking a pending task as done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-task-transition-'));
    temporaryDirectories.push(projectRoot);
    await createTaskFile(projectRoot, 'user-auth', 'setup-database', 'pending');

    await expect(
      updateTaskStatus(projectRoot, 'user-auth', 'setup-database', 'done'),
    ).rejects.toThrow('task is not in-progress');
  });
});
