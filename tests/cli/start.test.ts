import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildProgram } from '../../src/cli/index.js';
import { runCli } from './helpers.js';

const temporaryDirectories: string[] = [];
const originalWorkingDirectory = process.cwd();

afterEach(async () => {
  process.chdir(originalWorkingDirectory);
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

describe('start command', () => {
  it('transitions plan-ready feature to in-progress', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-start-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'plan-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: pending\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    await buildProgram().parseAsync(['node', 'scifi', 'start', 'user-auth']);

    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('in-progress');
  });

  it('is idempotent when feature is already in-progress (resume)', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-start-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'in-progress',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: pending\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const run = await runCli(['start', 'user-auth']);
    expect(run.exitCode).toBe(0);

    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('in-progress');
  });

  it('fails when feature is not plan-ready', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-start-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, '.scifi.json'),
      `${JSON.stringify(
        {
          version: 1,
          id: 'FEAT-0001',
          slug: 'user-auth',
          status: 'spec-ready',
          createdAt: '2026-05-20T00:00:00Z',
          updatedAt: '2026-05-20T00:00:00Z',
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');

    const run = await runCli(['start', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('must be plan-ready');
  });
});
