import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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

async function scaffoldFeature(projectRoot: string, slug: string): Promise<void> {
  const featureDir = join(projectRoot, 'docs', 'scifi', 'specs', slug);
  await mkdir(featureDir, { recursive: true });
  await writeFile(
    join(featureDir, '.scifi.json'),
    JSON.stringify({
      version: 1,
      slug,
      status: 'created',
      createdAt: '2026-06-11T00:00:00Z',
      updatedAt: '2026-06-11T00:00:00Z',
    }),
    'utf8',
  );
}

describe('worktree set command', () => {
  it('records the branch and worktree path and reports them', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);
    await scaffoldFeature(projectRoot, 'google-auth');

    const run = await runCli([
      'worktree',
      'set',
      'google-auth',
      '--branch',
      'feat/google-auth',
      '--path',
      '.worktrees/feat-google-auth',
    ]);

    expect(run.exitCode).toBe(0);
    expect(run.stdout).toContain('feat/google-auth');
    expect(run.stdout).toContain('.worktrees/feat-google-auth');

    const metadata = JSON.parse(
      await readFile(
        join(projectRoot, 'docs', 'scifi', 'specs', 'google-auth', '.scifi.json'),
        'utf8',
      ),
    ) as { branch?: string; worktreePath?: string };
    expect(metadata.branch).toBe('feat/google-auth');
    expect(metadata.worktreePath).toBe('.worktrees/feat-google-auth');
  });

  it('errors with NOT_FOUND for an unknown feature', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'scifi-worktree-cmd-'));
    temporaryDirectories.push(projectRoot);
    process.chdir(projectRoot);

    const run = await runCli([
      'worktree',
      'set',
      'ghost',
      '--branch',
      'feat/ghost',
      '--path',
      '.worktrees/feat-ghost',
      '--json',
    ]);

    expect(run.exitCode).toBe(3);
    expect(run.stderr).toContain('NOT_FOUND');
  });
});
