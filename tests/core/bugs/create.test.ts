import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createBug } from '../../../src/core/bugs/create.js';
import { readBugFile } from '../../../src/core/bugs/frontmatter.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('createBug', () => {
  it('creates bugs/ dir and writes a bug file', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-bug-create-'));
    temporaryDirectories.push(projectRoot);

    const result = await createBug({
      projectRoot,
      description: 'login crash on mobile',
      now: '2026-05-21T00:00:00.000Z',
    });

    expect(result.id).toBe('BUG-0001');
    expect(result.filePath).toBe(join(projectRoot, 'bugs', 'BUG-0001-login-crash-on-mobile.md'));

    const file = await readBugFile(result.filePath);
    expect(file.frontmatter.id).toBe('BUG-0001');
    expect(file.frontmatter.slug).toBe('login-crash-on-mobile');
    expect(file.frontmatter.status).toBe('open');
    expect(file.frontmatter.severity).toBeUndefined();
    expect(file.frontmatter['related-feature']).toBeUndefined();
    expect(file.body).toBe('# login crash on mobile\n');
  });

  it('creates a bug with optional severity and related-feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-bug-create-'));
    temporaryDirectories.push(projectRoot);

    const result = await createBug({
      projectRoot,
      description: 'null ref',
      severity: 'critical',
      relatedFeature: 'auth-flow',
      now: '2026-05-21T00:00:00.000Z',
    });

    const file = await readBugFile(result.filePath);
    expect(file.frontmatter.severity).toBe('critical');
    expect(file.frontmatter['related-feature']).toBe('auth-flow');
  });

  it('assigns sequential IDs based on existing file count', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-bug-create-'));
    temporaryDirectories.push(projectRoot);

    const first = await createBug({
      projectRoot,
      description: 'first bug',
      now: '2026-05-21T00:00:00.000Z',
    });
    const second = await createBug({
      projectRoot,
      description: 'second bug',
      now: '2026-05-21T00:00:00.000Z',
    });

    expect(first.id).toBe('BUG-0001');
    expect(second.id).toBe('BUG-0002');
  });

  it('creates bugs/ dir if it does not exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'specflow-bug-create-'));
    temporaryDirectories.push(projectRoot);

    await createBug({
      projectRoot,
      description: 'something broke',
      now: '2026-05-21T00:00:00.000Z',
    });

    const entries = await readdir(join(projectRoot, 'bugs'));
    expect(entries).toHaveLength(1);
  });
});
