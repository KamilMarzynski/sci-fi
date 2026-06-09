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

async function scaffoldFeature(projectRoot: string, slug: string, status: string): Promise<string> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
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
  return featureDir;
}

describe('plan-ready command', () => {
  it('transitions feature to plan-ready when design.md and tasks exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-plan-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, 'user-auth', 'spec-ready');
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: pending\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    await buildProgram().parseAsync(['node', 'scifi', 'plan-ready', 'user-auth']);

    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('plan-ready');
  });

  it('fails when design.md is missing', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-plan-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, 'user-auth', 'spec-ready');
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    const tasksDir = join(featureDir, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: pending\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const run = await runCli(['plan-ready', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('design.md is missing');
  });

  it('fails when no task files exist', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-plan-ready-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const featureDir = await scaffoldFeature(projectRoot, 'user-auth', 'spec-ready');
    await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');

    const run = await runCli(['plan-ready', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('no task files were found');
  });
});
