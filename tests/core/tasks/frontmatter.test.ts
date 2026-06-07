import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readTaskFile, writeTaskFile } from '../../../src/core/tasks/frontmatter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('readTaskFile', () => {
  it('parses frontmatter and body from a task file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'setup-database.md');

    await writeFile(
      filePath,
      `---\nid: TASK-001\nslug: setup-database\nstatus: pending\ndepends-on: []\n---\n# Setup Database\n\nCreate the schema.\n`,
      'utf8',
    );

    const file = await readTaskFile(filePath);

    expect(file.frontmatter).toEqual({
      id: 'TASK-001',
      slug: 'setup-database',
      status: 'pending',
      dependsOn: [],
    });
    expect(file.body).toBe('# Setup Database\n\nCreate the schema.\n');
  });

  it('parses depends-on entries as dependsOn array', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeFile(
      filePath,
      `---\nid: TASK-002\nslug: task\nstatus: pending\ndepends-on:\n  - setup-database\n---\nbody\n`,
      'utf8',
    );

    const file = await readTaskFile(filePath);
    expect(file.frontmatter.dependsOn).toEqual(['setup-database']);
  });

  it('throws when frontmatter is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeFile(filePath, '# Just a title\n', 'utf8');

    await expect(readTaskFile(filePath)).rejects.toThrow('missing YAML frontmatter');
  });

  it('throws when frontmatter is invalid', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeFile(filePath, '---\nfoo: bar\n---\nbody\n', 'utf8');

    await expect(readTaskFile(filePath)).rejects.toThrow('invalid frontmatter');
  });

  it('throws when frontmatter has unknown keys', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeFile(
      filePath,
      `---\nid: TASK-001\nslug: task\nstatus: pending\nparallel: false\ndepends-on: []\n---\nbody\n`,
      'utf8',
    );

    await expect(readTaskFile(filePath)).rejects.toThrow('invalid frontmatter');
  });
});

describe('writeTaskFile', () => {
  it('writes frontmatter and body to file', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeTaskFile(filePath, {
      frontmatter: {
        id: 'TASK-001',
        slug: 'setup-database',
        status: 'in-progress',
        dependsOn: [],
      },
      body: '# Setup Database\n',
    });

    const readBack = await readTaskFile(filePath);
    expect(readBack.frontmatter.status).toBe('in-progress');
    expect(readBack.frontmatter.id).toBe('TASK-001');
    expect(readBack.body).toBe('# Setup Database\n');
  });

  it('round-trips depends-on through write and read', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'specflow-frontmatter-'));
    temporaryDirectories.push(dir);
    const filePath = join(dir, 'task.md');

    await writeTaskFile(filePath, {
      frontmatter: {
        id: 'TASK-002',
        slug: 'implement-auth',
        status: 'pending',
        dependsOn: ['setup-database'],
      },
      body: 'body\n',
    });

    const readBack = await readTaskFile(filePath);
    expect(readBack.frontmatter.dependsOn).toEqual(['setup-database']);
  });
});
