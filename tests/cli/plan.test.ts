import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

async function setup(slug: string, status: string): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-plan-'));
  temporaryDirectories.push(projectRoot);
  process.chdir(projectRoot);
  const featureDir = await scaffoldFeature(projectRoot, slug, status);
  await writeFile(join(featureDir, 'spec.md'), '# Spec\n', 'utf8');
  return featureDir;
}

describe('plan command', () => {
  it('reports ready-to-plan for a fresh spec-ready feature', async () => {
    await setup('user-auth', 'spec-ready');

    const run = await runCli(['plan', 'user-auth']);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('plan ready-to-plan');
    expect(run.stdout).toContain('start the plan from scratch');
  });

  it('reports in-progress when partial design/tasks exist', async () => {
    const featureDir = await setup('user-auth', 'spec-ready');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');

    const run = await runCli(['plan', 'user-auth']);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('plan in-progress');
    expect(run.stdout).toContain('design.md: present');
  });

  it('reports already-planned once the feature is plan-ready', async () => {
    const featureDir = await setup('user-auth', 'plan-ready');
    await writeFile(join(featureDir, 'design.md'), '# Design\n', 'utf8');

    const run = await runCli(['plan', 'user-auth']);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('plan already-planned');
    expect(run.stdout).toContain('continue refining the existing plan or start over');
  });

  it('fails when the feature is not spec-ready yet', async () => {
    await setup('user-auth', 'created');

    const run = await runCli(['plan', 'user-auth']);

    expect(run.exitCode).toBe(4);
    expect(run.stderr).toContain('not spec-ready yet');
  });

  it('emits structured JSON with the plan session state', async () => {
    await setup('user-auth', 'spec-ready');

    const run = await runCli(['plan', 'user-auth', '--json']);

    expect(run.exitCode).toBe(0);
    const payload = JSON.parse(run.stdout) as {
      ok: boolean;
      data: {
        action: string;
        state: string;
        designExists: boolean;
        taskFileCount: number;
      };
    };
    expect(payload.ok).toBe(true);
    expect(payload.data.action).toBe('plan');
    expect(payload.data.state).toBe('ready-to-plan');
    expect(payload.data.designExists).toBe(false);
    expect(payload.data.taskFileCount).toBe(0);
  });
});
