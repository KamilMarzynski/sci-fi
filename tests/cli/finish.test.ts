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
  process.exitCode = 0;
  await Promise.all(temporaryDirectories.map((dir) => rm(dir, { recursive: true, force: true })));
  temporaryDirectories.length = 0;
});

async function scaffoldInProgressFeature(projectRoot: string): Promise<string> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
  const tasksDir = join(featureDir, 'tasks');
  await mkdir(tasksDir, { recursive: true });
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
  return tasksDir;
}

describe('finish command', () => {
  it('transitions in-progress feature to done when all tasks are done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-finish-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: done\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    await buildProgram().parseAsync(['node', 'scifi', 'finish', 'user-auth']);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('done');
  });

  it('fails when a task is not done', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-finish-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: in-progress\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const run = await runCli(['finish', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('not all tasks are complete');
  });

  it('fails when there are open fixes', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-finish-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: done\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      '---\nid: FIX-0001\nslug: token-expiry\nstatus: open\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n',
      'utf8',
    );

    const run = await runCli(['finish', 'user-auth']);
    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('Cannot finish user-auth');
    expect(run.stderr).toContain('FIX-0001');

    const jsonRun = await runCli(['finish', 'user-auth', '--json']);
    expect(jsonRun.exitCode).toBe(4);
    const payload = JSON.parse(jsonRun.stderr);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe('PRECONDITION_FAILED');
    expect(payload.error.details.openFixes[0].id).toBe('FIX-0001');
  });

  it('succeeds when all fixes are resolved', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-finish-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const tasksDir = await scaffoldInProgressFeature(projectRoot);
    await writeFile(
      join(tasksDir, 'setup-db.md'),
      '---\nid: TASK-001\nslug: setup-db\nstatus: done\ndepends-on: []\n---\n# Setup DB\n',
      'utf8',
    );

    const fixesDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth', 'fixes');
    await mkdir(fixesDir, { recursive: true });
    await writeFile(
      join(fixesDir, 'FIX-0001-token-expiry.md'),
      '---\nid: FIX-0001\nslug: token-expiry\nstatus: resolved\nfeature: user-auth\ncreated: 2026-05-21T00:00:00.000Z\n---\n# token expiry\n',
      'utf8',
    );

    await buildProgram().parseAsync(['node', 'scifi', 'finish', 'user-auth']);

    const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', 'user-auth');
    const metadata = JSON.parse(await readFile(join(featureDir, '.scifi.json'), 'utf8')) as {
      status: string;
    };
    expect(metadata.status).toBe('done');
  });
});
