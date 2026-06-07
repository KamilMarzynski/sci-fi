import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { listTasks } from '../../../src/core/tasks/list.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

function makeTaskContent(slug: string, status: string): string {
  return `---\nid: TASK-001\nslug: ${slug}\nstatus: ${status}\ndepends-on: []\n---\n# ${slug}\n`;
}

describe('listTasks', () => {
  it('returns empty array when tasks/ directory does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-list-tasks-'));
    temporaryDirectories.push(projectRoot);
    const featureRoot = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth');
    await mkdir(featureRoot, { recursive: true });

    const tasks = await listTasks(projectRoot, 'user-auth');
    expect(tasks).toEqual([]);
  });

  it('returns frontmatter for each .md file in tasks/', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-list-tasks-'));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', 'tasks');
    await mkdir(tasksDir, { recursive: true });

    await writeFile(
      join(tasksDir, 'setup-database.md'),
      makeTaskContent('setup-database', 'pending'),
      'utf8',
    );
    await writeFile(
      join(tasksDir, 'implement-auth.md'),
      makeTaskContent('implement-auth', 'in-progress'),
      'utf8',
    );

    const tasks = await listTasks(projectRoot, 'user-auth');
    expect(tasks).toHaveLength(2);

    const slugs = tasks.map((t) => t.slug).sort();
    expect(slugs).toEqual(['implement-auth', 'setup-database']);
  });

  it('ignores non-.md files in tasks/', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-list-tasks-'));
    temporaryDirectories.push(projectRoot);
    const tasksDir = join(projectRoot, 'docs', 'specflow', 'specs', 'user-auth', 'tasks');
    await mkdir(tasksDir, { recursive: true });

    await writeFile(
      join(tasksDir, 'setup-database.md'),
      makeTaskContent('setup-database', 'pending'),
      'utf8',
    );
    await writeFile(join(tasksDir, 'notes.txt'), 'ignore me', 'utf8');

    const tasks = await listTasks(projectRoot, 'user-auth');
    expect(tasks).toHaveLength(1);
  });
});
